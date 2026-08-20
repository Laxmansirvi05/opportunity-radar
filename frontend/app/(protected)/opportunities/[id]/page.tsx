import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import { SaveForLaterButton } from '@/features/opportunities/components/opportunity-detail/save-for-later-button'
import { ReportBrokenLinkButton } from '@/features/opportunities/components/opportunity-detail/report-broken-link-button'
import { ApplyWorkflowButton } from '@/features/opportunities/components/opportunity-detail/apply-workflow-button'
import { ShareOpportunityButton } from '@/features/opportunities/components/opportunity-detail/share-opportunity-button'
import { getDeadlineInfo } from '@/features/opportunities/utils/deadline'
import { extractSkillsFromDescription, sanitizeAndFormatDescription } from '@/utils/skills-parser'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'
import { OpportunityNotes } from '@/features/notes/components/opportunity-notes'
import type { OpportunityWithDetails } from '@/types/opportunity'

/** The company row joined onto an opportunity (Supabase types embedded joins loosely). */
interface CompanyRow {
  id?: string
  name?: string | null
  logo_url?: string | null
  website_url?: string | null
  description?: string | null
  industry?: string | null
  founded_year?: number | null
  headquarters?: string | null
}

/** A lightweight related-opportunity row used by the "more roles" rails. */
interface RelatedOpp {
  id: string
  title?: string | null
  location?: string | null
  mode?: string | null
  is_paid?: boolean | null
  status?: string | null
  deadline?: string | null
  companies?: { name?: string | null } | null
}

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch user and opportunity concurrently
  const [
    { data: { user } },
    { data: opp, error }
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('opportunities')
      .select(`
        *,
        companies (id, name, logo_url, website_url, description, industry, founded_year, headquarters, created_at),
        opportunity_tags (tag_name)
      `)
      .eq('id', id)
      .single()
  ])

  // The caller's tracker row for this listing, if they have one — a note
  // written on this page is associated with it as well as the opportunity.
  // Never fabricated: absent tracker row means the note carries no
  // application_id at all.
  let applicationId: string | null = null
  if (user) {
    const { data: tracked } = await supabase
      .from('application_tracker')
      .select('id')
      .eq('user_id', user.id)
      .eq('opportunity_id', id)
      .maybeSingle()
    applicationId = tracked?.id ?? null
  }

  // Upsert Recently Viewed (Fire and forget to avoid blocking render)
  if (user) {
    supabase.from('recently_viewed').upsert({
      user_id: user.id,
      opportunity_id: id,
      viewed_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,opportunity_id'
    }).then(({ error }) => {
      if (error) console.error('Failed to upsert recently viewed:', error)
    })
  }

  if (error || !opp) {
    notFound()
  }

  const company = opp.companies as CompanyRow | null
  const tags = (opp.opportunity_tags || []) as { tag_name: string }[]
  
  const deadlineInfo = getDeadlineInfo(opp.deadline)
  const isExpired = deadlineInfo?.expired ?? false

  const nowISO = new Date().toISOString()

  // Parallelize secondary queries
  const similarOppsPromise = supabase
    .from('opportunities')
    .select('id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url, description, companies (id, name, logo_url, website_url), opportunity_tags (tag_name)')
    .eq('category', opp.category)
    .neq('id', opp.id)
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${nowISO}`)
    .limit(3)

  const moreFromCompanyPromise = opp.company_id 
    ? supabase
        .from('opportunities')
        .select('id, title, location, mode, is_paid')
        .eq('company_id', opp.company_id)
        .neq('id', opp.id)
        .in('status', ['Published', 'Closing Soon'])
        .or(`deadline.is.null,deadline.gte.${nowISO}`)
        .limit(3)
    : Promise.resolve({ data: null })

  const peopleAlsoViewedPromise = supabase
    .from('opportunities')
    .select('id, title, companies(name)')
    .neq('id', opp.id)
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${nowISO}`)
    .limit(3)

  const [
    { data: similarOppsData },
    { data: moreFromCompanyData },
    { data: peopleAlsoViewedData }
  ] = await Promise.all([
    similarOppsPromise,
    moreFromCompanyPromise,
    peopleAlsoViewedPromise
  ])

  const filterActive = (opps: RelatedOpp[] | null): RelatedOpp[] => {
    if (!opps) return []
    const nowMs = new Date().getTime()
    return opps.filter(o => {
      if (o.status && ['Closed', 'Expired'].includes(o.status)) return false
      if (!o.deadline) return true
      return new Date(o.deadline).getTime() >= nowMs
    })
  }

  const similarOpps = filterActive((similarOppsData ?? []) as unknown as RelatedOpp[])
  const moreFromCompany = filterActive((moreFromCompanyData ?? []) as unknown as RelatedOpp[])
  const peopleAlsoViewed = filterActive((peopleAlsoViewedData ?? []) as unknown as RelatedOpp[])

  /**
   * Compensation, labelled for the kind of opportunity.
   *
   * A student's first question is "does this pay, and how much". Previously the
   * page never said, so the answer is always rendered — including an explicit
   * "Unpaid" or "Not disclosed" rather than an empty space that could be read
   * either way.
   */
  const isContest = ['Hackathon', 'Competition', 'Workshop'].includes(opp.category ?? '')
  const compensation = (() => {
    const label = isContest ? 'Prize Pool' : opp.category === 'Internship' ? 'Stipend' : 'Salary'
    const amount = (opp.salary_range ?? '').toString().trim()

    if (amount) {
      return { label, value: amount, tone: 'text-on-surface', note: null as string | null }
    }
    if (opp.is_paid === false) {
      return {
        label,
        value: isContest ? 'No cash prize' : 'Unpaid',
        tone: 'text-on-surface-variant',
        note: isContest ? 'Certificate or recognition only.' : 'This opportunity is unpaid.',
      }
    }
    return {
      label,
      value: 'Not disclosed',
      tone: 'text-on-surface-variant',
      note: `The ${isContest ? 'organiser' : 'employer'} has not published a figure. Check the listing before applying.`,
    }
  })()

  const OFFICIAL_SOURCES = ['greenhouse', 'lever', 'smartrecruiters', 'amazon']
  const isOfficialSource = OFFICIAL_SOURCES.includes((opp.source ?? '').toLowerCase())
  const sourceLabel = isOfficialSource
    ? `Official — ${company?.name ?? opp.company_name ?? 'company'} careers portal`
    : (opp.source ?? '').toLowerCase() === 'unstop'
      ? 'Unstop'
      : (opp.source ?? '').toLowerCase() === 'internshala'
        ? 'Internshala'
        : 'Verified source'

  const industry = company?.industry || opp.category || 'Technology'
  
  const responsibilities = opp.responsibilities || []
  const oppSkills = opp.skills && opp.skills.length > 0 ? opp.skills : tags.map((t) => t.tag_name)
  
  const finalSkills = oppSkills.length > 0 ? oppSkills : extractSkillsFromDescription(opp.description)
  const cleanDescription = sanitizeAndFormatDescription(opp.description)

  return (
    <div className="flex flex-col w-full pb-16 bg-surface-container-lowest min-h-screen">
      
      {/* Top Navigation / Breadcrumb */}
      <div className="py-6 px-4 md:px-8 max-w-[1600px] mx-auto w-full">
        <div className="flex items-center text-sm font-medium text-on-surface-variant gap-2">
          <Link href="/search" className="hover:text-primary transition-colors">Search</Link>
          {opp.category && (
            <>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <Link
                href={`/search?category=${encodeURIComponent(opp.category)}`}
                className="hover:text-primary transition-colors"
              >
                {opp.category}
              </Link>
            </>
          )}
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-on-surface">{opp.title}</span>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-10">
          
          {/* Main Header Box */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <CompanyLogo
                src={company?.logo_url}
                alt={`${company?.name ?? 'Company'} logo`}
                containerClassName="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm shrink-0"
                imageClassName="w-10 h-10 md:w-12 md:h-12 object-contain"
              />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-on-background leading-tight">{opp.title}</h1>
                  <span className="px-2.5 py-1 rounded-md bg-[#E6F4EA] text-[#137333] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                    Verified
                  </span>
                </div>
                
                {company && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-base text-on-surface">{company.name}</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">verified</span>
                        Verified Source
                      </span>
                      {company.website_url && (
                        <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline ml-1">
                          View Profile
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-on-surface-variant mt-0.5">
                      <span>{opp.location ?? (opp.mode === 'Remote' ? 'Remote' : 'Location TBD')} {opp.mode && `(${opp.mode})`}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant" />
                      <span>{industry}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* About the Role */}
          {cleanDescription && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-on-background">About the Role</h2>
              <div 
                className="text-on-surface-variant leading-relaxed text-[15px] whitespace-pre-wrap font-body-md break-words"
                dangerouslySetInnerHTML={{ __html: cleanDescription }}
              />
            </section>
          )}

          {/* Skills Required */}
          {finalSkills.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-on-background">Skills Required</h2>
              <div className="flex flex-wrap gap-2">
                {finalSkills.map((skill: string) => (
                  <span key={skill} className="px-4 py-1.5 rounded-full border border-outline-variant text-sm font-medium text-primary bg-surface shadow-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Responsibilities */}
          {responsibilities.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-on-background">Responsibilities</h2>
              <ul className="flex flex-col gap-3">
                {responsibilities.map((resp: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[14px] text-primary font-bold">check</span>
                    </div>
                    <span className="text-[15px] text-on-surface-variant">{resp}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* More from Company */}
          {moreFromCompany && moreFromCompany.length > 0 && (
            <section className="flex flex-col gap-4 mt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-on-background">More from {company?.name}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {moreFromCompany.map((item, idx) => (
                  <Link key={item.id || idx} href={`/opportunities/${item.id}`} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer block">
                    <h4 className="font-bold text-sm text-on-surface mb-1 truncate">{item.title}</h4>
                    <p className="text-xs text-on-surface-variant truncate">
                      {[item.location, item.mode].filter(Boolean).join(' • ') || 'Location TBD'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* More opportunities — other active listings. Deliberately NOT
              labelled "People also viewed": there is no view-tracking behind
              this, it's a sample of live roles, and the project's rule is to
              never present fabricated signals as data. */}
          {peopleAlsoViewed && peopleAlsoViewed.length > 0 && (
            <section className="flex flex-col gap-4 mt-2">
              <h2 className="text-lg font-bold text-on-background">More opportunities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {peopleAlsoViewed.map((item, idx) => (
                  <Link key={item.id || idx} href={`/opportunities/${item.id}`} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer block">
                    <h4 className="font-bold text-sm text-on-surface mb-1 truncate">{item.title}</h4>
                    {item.companies?.name && (
                      <p className="text-xs text-on-surface-variant truncate">{item.companies.name}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <OpportunityNotes opportunityId={opp.id} applicationId={applicationId} />

        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          
          {/* Deadline / Apply Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Application Deadline</span>
                <span className="font-bold text-on-surface">{opp.deadline ? new Date(opp.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Rolling'}</span>
              </div>
              {deadlineInfo && (
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${deadlineInfo.colorClass}`}>
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {deadlineInfo.label}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <ApplyWorkflowButton opportunityId={opp.id} applyUrl={opp.apply_url} expired={isExpired} />
              <div className="grid grid-cols-2 gap-3">
                <SaveForLaterButton opportunityId={opp.id} expired={isExpired} />
                <ShareOpportunityButton title={opp.title} />
              </div>
            </div>
            <p className="text-xs text-center text-on-surface-variant/80 font-medium">
              You will be redirected to the company&apos;s portal.
            </p>
          </div>

          {/* Key Details Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Key Details</h3>

            {/* Compensation — labelled for the kind of opportunity this is.
                Always shown: a student should never have to guess whether a
                role pays, so an unknown says so explicitly rather than hiding. */}
            <div className="flex flex-col gap-1.5 pb-4 border-b border-outline-variant">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                {compensation.label}
              </span>
              <span className={`text-lg font-bold ${compensation.tone}`}>
                {compensation.value}
              </span>
              {compensation.note && (
                <span className="text-xs text-on-surface-variant">{compensation.note}</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm gap-3">
                <span className="text-on-surface-variant shrink-0">Type</span>
                <span className="font-semibold text-on-surface text-right">{opp.category ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center text-sm gap-3">
                <span className="text-on-surface-variant shrink-0">Work mode</span>
                <span className="font-semibold text-on-surface text-right">
                  {opp.mode ?? (opp.is_remote ? 'Remote' : '—')}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm gap-3">
                <span className="text-on-surface-variant shrink-0">Location</span>
                <span className="font-semibold text-on-surface text-right truncate max-w-[170px]">
                  {opp.location || (opp.is_remote ? 'Remote' : '—')}
                </span>
              </div>
              {opp.posted_at && (
                <div className="flex justify-between items-center text-sm gap-3">
                  <span className="text-on-surface-variant shrink-0">Posted</span>
                  <span className="font-semibold text-on-surface text-right">
                    {new Date(opp.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Source & Trust Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Source</h3>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">verified</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-on-surface">{sourceLabel}</span>
                <span className="text-xs text-on-surface-variant leading-relaxed">
                  {isOfficialSource
                    ? 'Published on the employer’s own careers portal. Applying takes you straight to them.'
                    : 'Listed on a verified opportunity platform.'}
                </span>
              </div>
            </div>
            <ReportBrokenLinkButton opportunityId={opp.id} />
          </div>

          {/* Company Profile Card */}
          {company && (
            <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Company Profile</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {company.description}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {company.founded_year && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Founded</span>
                    <span className="text-sm font-bold text-on-surface">{company.founded_year}</span>
                  </div>
                )}
                {company.headquarters && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Headquarters</span>
                    <span className="text-sm font-bold text-on-surface">{company.headquarters}</span>
                  </div>
                )}
              </div>
              <Link href={`/search?q=${encodeURIComponent(company.name ?? '')}`} className="mt-2 text-sm font-bold text-primary hover:underline flex items-center gap-1 w-fit">
                View all roles at {company.name}
                <span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>
              </Link>
            </div>
          )}

          {/* Posted By Card */}
          {opp.recruiter_name && (
            <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Posted By</h3>
              <div className="flex items-center gap-3">
                {opp.recruiter_avatar_url && (
                  <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant/50">
                    <Image
                      src={opp.recruiter_avatar_url}
                      alt={`${opp.recruiter_name} avatar`}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-on-surface text-sm">{opp.recruiter_name}</span>
                  {opp.recruiter_role && <span className="text-xs text-on-surface-variant">{opp.recruiter_role}</span>}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Full Width - Similar Opportunities */}
      <div className="w-full border-t border-outline-variant/60 mt-16 pt-12 pb-16 bg-surface-container-lowest">
        <div className="px-4 md:px-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-on-background">Similar Opportunities in {industry}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {similarOpps && similarOpps.length > 0 && (
              similarOpps.map((related) => (
                <OpportunitySearchCard key={related.id} opportunity={related as unknown as OpportunityWithDetails} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-[#f8fafc] border-t border-outline-variant/60 py-8 hidden md:block">
        <div className="px-4 md:px-8 max-w-[1600px] mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-bold text-primary">Opportunity Radar</div>
          <div className="flex items-center gap-6 text-sm font-medium text-on-surface-variant">
            <Link href="/" className="hover:text-primary transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-primary transition-colors">Contact</Link>
          </div>
          <div className="text-xs text-on-surface-variant font-medium">
            © 2026 Opportunity Radar
          </div>
        </div>
      </footer>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant p-4 flex gap-3 z-[60] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <ApplyWorkflowButton opportunityId={opp.id} applyUrl={opp.apply_url} expired={isExpired} />
        <div className="w-12 h-12 flex items-center justify-center shrink-0">
          <SaveForLaterButton opportunityId={opp.id} expired={isExpired} />
        </div>
      </div>
    </div>
  )
}
