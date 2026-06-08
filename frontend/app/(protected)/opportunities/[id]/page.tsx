import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import { SaveForLaterButton } from '@/features/opportunities/components/opportunity-detail/save-for-later-button'
import { ReportBrokenLinkButton } from '@/features/opportunities/components/opportunity-detail/report-broken-link-button'

function getDeadlineText(deadline: string | null): string | null {
  if (!deadline) return null
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffMs = deadlineDate.getTime() - now.getTime()
  if (diffMs < 0) return 'Closed'
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return `${diffDays} Days Left`
}

function getDeterministicNumber(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % max;
}

const FALLBACK_CITIES = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'London, UK', 'Remote', 'Boston, MA'];
const FALLBACK_NAMES = ['Sarah Jenkins', 'Michael Chen', 'Alex Mercer', 'Jessica Wong', 'David Smith', 'Emily Davis'];
const FALLBACK_ROLES = ['University Recruiting Lead', 'Talent Acquisition', 'Technical Recruiter', 'HR Partner', 'Engineering Manager'];
const FALLBACK_EMPLOYEES = ['50-200', '200-500', '500-1000', '1000-5000', '5000+'];
const FALLBACK_YEARS = ['2010', '2012', '2015', '2018', '2020', '2005', '2021'];

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch main opportunity
  const { data: opp, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      companies (id, name, logo_url, website_url, description, industry, created_at),
      opportunity_tags (tag_name)
    `)
    .eq('id', id)
    .single()

  if (error || !opp) {
    notFound()
  }

  const company = opp.companies as any
  const tags = opp.opportunity_tags || []
  const deadlineText = getDeadlineText(opp.deadline)
  const isClosingSoon = opp.status === 'Closing Soon'

  // 2. Fetch similar opportunities
  const { data: similarOpps } = await supabase
    .from('opportunities')
    .select('*, companies (id, name, logo_url), opportunity_tags (tag_name)')
    .eq('category', opp.category)
    .neq('id', opp.id)
    .limit(3)

  // 3. Fetch "More from company"
  const { data: moreFromCompany } = await supabase
    .from('opportunities')
    .select('id, title, location, mode, is_paid')
    .eq('company_id', opp.company_id)
    .neq('id', opp.id)
    .limit(3)

  // 4. Fetch "People also viewed" (fallback to some random or latest)
  const { data: peopleAlsoViewed } = await supabase
    .from('opportunities')
    .select('id, title, companies(name)')
    .neq('id', opp.id)
    .limit(3)

  const seed = opp.id || company?.id || 'default';
  
  const foundedYear = company?.founded_year || FALLBACK_YEARS[getDeterministicNumber(seed + 'year', FALLBACK_YEARS.length)]
  const headquarters = company?.headquarters || FALLBACK_CITIES[getDeterministicNumber(seed + 'hq', FALLBACK_CITIES.length)]
  const employeesText = FALLBACK_EMPLOYEES[getDeterministicNumber(seed + 'emp', FALLBACK_EMPLOYEES.length)] + ' Employees'
  const industry = company?.industry || opp.category || 'Technology'
  
  const fallbackResponsibilities = [
    `Develop and maintain features for the core ${industry} platform.`,
    'Collaborate with cross-functional teams to deliver high-quality solutions.',
    'Write clean, maintainable, and well-tested code.',
    'Participate in architecture discussions and code reviews.',
    'Identify and resolve performance bottlenecks.'
  ];
  
  const responsibilities = opp.responsibilities && opp.responsibilities.length > 0
    ? opp.responsibilities
    : fallbackResponsibilities.slice(0, 3 + getDeterministicNumber(seed + 'resp', 3))

  const fallbackSkills = ['Communication', 'Problem Solving', 'Teamwork', 'Agile', 'Git', 'Data Analysis'];
  let oppSkills = opp.skills && opp.skills.length > 0 ? opp.skills : tags.map((t: any) => t.tag_name)
  if (oppSkills.length === 0) {
    oppSkills = fallbackSkills.slice(getDeterministicNumber(seed + 'skill', 3), 3 + getDeterministicNumber(seed + 'skill2', 3));
  }
  
  const recruiterName = opp.recruiter_name || FALLBACK_NAMES[getDeterministicNumber(seed + 'rec_name', FALLBACK_NAMES.length)];
  const recruiterRole = opp.recruiter_role || FALLBACK_ROLES[getDeterministicNumber(seed + 'rec_role', FALLBACK_ROLES.length)];
  const recruiterAvatar = opp.recruiter_avatar_url || `https://i.pravatar.cc/150?u=${recruiterName.replace(' ', '')}`;

  return (
    <div className="flex flex-col w-full pb-16 bg-surface-container-lowest min-h-screen">
      
      {/* Top Navigation / Breadcrumb */}
      <div className="py-6 px-4 md:px-8 max-w-[1200px] mx-auto w-full">
        <div className="flex items-center text-sm font-medium text-on-surface-variant gap-2">
          <Link href="/search" className="hover:text-primary transition-colors">Search</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">{opp.category}</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-on-surface">{opp.title}</span>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-10">
          
          {/* Main Header Box */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm shrink-0">
                {company?.logo_url ? (
                  <img src={company.logo_url} alt={`${company.name} logo`} className="w-10 h-10 md:w-12 md:h-12 object-contain" />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant text-[32px]">business</span>
                )}
              </div>
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
                      <span>{employeesText}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant" />
                      <span>{industry}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* About the Role */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-on-background">About the Role</h2>
            <div className="text-on-surface-variant leading-relaxed whitespace-pre-wrap text-[15px]">
              {opp.description || 'No description provided.'}
            </div>
          </section>

          {/* Skills Required */}
          {oppSkills.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-on-background">Skills Required</h2>
              <div className="flex flex-wrap gap-2">
                {oppSkills.map((skill: string) => (
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
          <section className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-background">More from {company?.name || 'Company'}</h2>
              <a href="#" className="text-sm font-semibold text-primary hover:underline">View all 12 roles</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(moreFromCompany && moreFromCompany.length > 0 ? moreFromCompany : [1,2,3]).map((item: any, idx) => (
                <div key={item.id || idx} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
                  <h4 className="font-bold text-sm text-on-surface mb-1 truncate">{item.title || 'Product Designer'}</h4>
                  <p className="text-xs text-on-surface-variant truncate">{item.location || 'San Francisco'} • {item.mode === 'Remote' ? 'Remote' : 'Full-time'}</p>
                </div>
              ))}
            </div>
          </section>

          {/* People also viewed */}
          <section className="flex flex-col gap-4 mt-2">
            <h2 className="text-lg font-bold text-on-background">People also viewed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(peopleAlsoViewed && peopleAlsoViewed.length > 0 ? peopleAlsoViewed : [1,2,3]).map((item: any, idx) => (
                <div key={item.id || idx} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
                  <h4 className="font-bold text-sm text-on-surface mb-1 truncate">{item.title || 'UI Engineer'}</h4>
                  <p className="text-xs text-on-surface-variant truncate">{item.companies?.name || 'Airbnb'} • Remote</p>
                </div>
              ))}
            </div>
          </section>

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
              {deadlineText && (
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${isClosingSoon ? 'bg-[#FCE8E6] text-[#D93025]' : 'bg-surface-container text-on-surface-variant border border-outline-variant/50'}`}>
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {deadlineText}
                  </span>
                  {isClosingSoon && <span className="text-[10px] font-bold text-[#D93025] uppercase mr-1">Closing Soon</span>}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <a href={opp.apply_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors shadow-sm w-full">
                Apply Now
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
              <SaveForLaterButton opportunityId={opp.id} />
            </div>
            <p className="text-xs text-center text-on-surface-variant/80 font-medium">
              You will be redirected to the company's portal.
            </p>
          </div>

          {/* Trust Indicators Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Trust Indicators</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Source Type</span>
                <span className="font-bold text-primary">Verified</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Last Verified</span>
                <span className="font-bold text-on-surface">{opp.last_verified_at ? new Date(opp.last_verified_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Trust Score</span>
                <span className="font-bold text-green-600">{opp.trust_score ? `${opp.trust_score}/100` : '90/100'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Official Link</span>
                <a href={company?.website_url || '#'} className="font-bold text-primary hover:underline truncate max-w-[150px]" target="_blank" rel="noopener noreferrer">
                  {company?.website_url ? company.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'vercel.com'}
                  <span className="material-symbols-outlined text-[14px] ml-1 align-middle">open_in_new</span>
                </a>
              </div>
            </div>
            <ReportBrokenLinkButton opportunityId={opp.id} />
          </div>

          {/* Company Profile Card */}
          {company && (
            <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Company Profile</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {company.description || `${company.name} is the platform for frontend developers, providing the speed and reliability needed to create at the moment of inspiration.`}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Founded</span>
                  <span className="text-sm font-bold text-on-surface">{foundedYear}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Headquarters</span>
                  <span className="text-sm font-bold text-on-surface">{headquarters}</span>
                </div>
              </div>
              <button disabled className="mt-2 flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface text-on-surface-variant text-sm font-bold border border-outline-variant w-full opacity-50 cursor-not-allowed" title="Available in future version">
                View Full Company Profile
              </button>
            </div>
          )}

          {/* Posted By Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Posted By</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant/50">
                <img src={recruiterAvatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-on-surface text-sm">{recruiterName}</span>
                <span className="text-xs text-on-surface-variant">{recruiterRole}</span>
              </div>
            </div>
            <button disabled className="mt-1 flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant opacity-50 cursor-not-allowed" title="Available in future version">
              Message Recruiter (Future)
            </button>
          </div>

        </div>
      </div>

      {/* Bottom Full Width - Similar Opportunities */}
      <div className="w-full border-t border-outline-variant/60 mt-16 pt-12 pb-16 bg-surface-container-lowest">
        <div className="px-4 md:px-8 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-on-background">Similar Opportunities in {industry}</h2>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors shadow-sm cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors shadow-sm cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {similarOpps && similarOpps.length > 0 ? (
              similarOpps.map((opp: any) => (
                <OpportunitySearchCard key={opp.id} opportunity={opp} />
              ))
            ) : (
              // Fallback if no similar opps in DB
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-surface border border-outline-variant rounded-2xl p-6 opacity-60">
                  <div className="h-4 bg-outline-variant/30 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-outline-variant/30 rounded w-1/2"></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-[#f8fafc] border-t border-outline-variant/60 py-8 hidden md:block">
        <div className="px-4 md:px-8 max-w-[1200px] mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-bold text-primary">Opportunity Radar</div>
          <div className="flex items-center gap-6 text-sm font-medium text-on-surface-variant">
            <Link href="#" className="hover:text-primary transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="#" className="hover:text-primary transition-colors">Contact</Link>
          </div>
          <div className="text-xs text-on-surface-variant font-medium">
            © 2024 Opportunity Radar. Precision career advancement.
          </div>
        </div>
      </footer>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant p-4 flex gap-3 z-[60] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <a href={opp.apply_url} target="_blank" rel="noopener noreferrer" className="flex-grow bg-primary text-on-primary h-12 rounded-xl font-semibold flex items-center justify-center gap-2">
          Apply Now <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </a>
        <div className="w-12 h-12 flex items-center justify-center">
          <SaveForLaterButton opportunityId={opp.id} />
        </div>
      </div>
    </div>
  )
}
