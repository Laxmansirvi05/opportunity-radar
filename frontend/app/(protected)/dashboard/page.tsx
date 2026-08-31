import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import { DashboardAlerts, Alert } from '@/features/dashboard/components/dashboard-alerts'

export const metadata = {
  title: 'Command Center | Opportunity Radar',
}

export const revalidate = 60;

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 1. Fetch Profile & Metrics concurrently
  const [
    { data: profile },
    { data: bookmarksRaw },
    { data: trackerItems },
    { data: freshOpportunities },
    { data: recentViews }
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, university, skills, resume_name')
      .eq('id', user.id)
      .single(),

    // A head-count of every bookmark row, not just live ones, would tell a
    // student "10 saved opportunities waiting for action" and link them to
    // /profile/saved — which filters out anything past its deadline or
    // closed, the same way this count now does. Without this, a fully
    // expired bookmark list showed a real number linking to an empty page.
    supabase
      .from('bookmarks')
      .select('id, opportunities(deadline, status)')
      .eq('user_id', user.id),

    supabase
      .from('application_tracker')
      .select('status')
      .eq('user_id', user.id),

    supabase
      .from('opportunities')
      .select('id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url, description, companies(id, name, logo_url, website_url), opportunity_tags(tag_name)')
      .eq('status', 'Published')
      .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
      .order('posted_at', { ascending: false })
      .limit(6),

    supabase
      .from('recently_viewed')
      .select('viewed_at, opportunities(id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url, description, companies(id, name, logo_url, website_url), opportunity_tags(tag_name))')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(15)
  ])

  let appliedCount = 0
  let interviewCount = 0
  let offerCount = 0

  if (trackerItems) {
    trackerItems.forEach(item => {
      if (item.status === 'Applied') appliedCount++
      if (item.status === 'Interview Scheduled') interviewCount++
      if (item.status === 'Selected') offerCount++
    })
  }

  const now = new Date()

  // Same filter /profile/saved applies before rendering — a bookmark whose
  // opportunity has passed its deadline or closed doesn't count as "waiting
  // for action" here either.
  const savedCount = (bookmarksRaw || []).filter((b: any) => {
    const opp = b.opportunities
    if (!opp) return false
    return (!opp.deadline || new Date(opp.deadline) >= now) && !['Closed', 'Expired'].includes(opp.status)
  }).length

  const recentlyViewed = (recentViews?.map((v: any) => v.opportunities).filter(Boolean) || [])
    .filter((opp: any) => {
      if ((opp.deadline && new Date(opp.deadline) < now) || ['Closed', 'Expired'].includes(opp.status)) return false
      if (!opp.description || opp.description.trim().length < 80) return false
      if (!opp.opportunity_tags || opp.opportunity_tags.length < 2) return false
      return true
    })
    .slice(0, 7)

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'

  // 3. Compute Intelligence
  // Calculate profile completeness dynamically based on fields present
  let profileCompleteness = 0
  if (profile) {
    if (profile.name) profileCompleteness += 20
    if (profile.university) profileCompleteness += 20
    if (profile.skills && profile.skills.length > 0) profileCompleteness += 30
    if (profile.resume_name) profileCompleteness += 30
  }
  const isProfileComplete = profileCompleteness === 100
  const hasResume = profile && profile.resume_name

  const recommendations = []
  if (!isProfileComplete) {
    recommendations.push({
      id: 'complete-profile',
      icon: 'person',
      title: 'Complete Your Profile',
      description: 'Add missing details to improve recommendations.',
      link: '/profile'
    })
  }
  if (!hasResume) {
    recommendations.push({
      id: 'upload-resume',
      icon: 'upload_file',
      title: 'Upload Your Resume',
      description: 'Recruiters and opportunities often require a resume.',
      link: '/profile'
    })
  }
  if (savedCount && savedCount > 0) {
    recommendations.push({
      id: 'review-saved',
      icon: 'bookmark',
      title: 'Review Saved Opportunities',
      description: 'You have saved opportunities waiting for action.',
      link: '/profile/saved'
    })
  }
  if (appliedCount > 0) {
    recommendations.push({
      id: 'follow-up',
      icon: 'forward_to_inbox',
      title: 'Follow Up On Applications',
      description: 'Track your active applications.',
      link: '/tracker'
    })
  }

  const alerts: Alert[] = []
  if (!hasResume) {
    alerts.push({
      id: 'missing-resume',
      title: 'Resume Missing',
      subtitle: 'Required',
      description: 'Upload your resume to apply for opportunities.'
    })
  }
  if (!isProfileComplete) {
    alerts.push({
      id: 'incomplete-profile',
      title: 'Profile Incomplete',
      subtitle: 'Important',
      description: 'Complete your profile to receive better matches.'
    })
  }
  if (savedCount && savedCount > 0) {
    alerts.push({
      id: 'saved-waiting',
      title: 'Saved Opportunities Waiting',
      subtitle: `${savedCount} items`,
      description: 'Review your saved list and submit applications.'
    })
  }
  if (interviewCount > 0) {
    alerts.push({
      id: 'interview-scheduled',
      title: 'Interview Scheduled',
      subtitle: 'Action',
      description: `You have ${interviewCount} interview(s) to prepare for.`
    })
  }

  alerts.push({
    id: 'optimize-resume',
    title: 'Optimize Your Resume',
    subtitle: 'Action',
    description: 'Improve your resume before applying to your next opportunity.'
  })

  alerts.push({
    id: 'ai-voice-interview',
    title: 'Take an AI Voice Interview',
    subtitle: 'Action',
    description: 'Practice your interview skills with an AI-powered voice interview.'
  })

  const hasNoTrackerItems = !savedCount && appliedCount === 0 && interviewCount === 0 && offerCount === 0

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <header className="mb-2 py-2 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-background">
            Action Station: {displayName}
          </h2>
          <p className="text-base md:text-lg text-on-surface-variant">Focus on today&apos;s highest-impact career opportunities.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/search" className="flex-1 md:flex-none bg-primary text-on-primary font-label-md text-label-md font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Apply Now
          </Link>
          <button aria-label="Notifications" className="w-10 h-10 rounded-xl bg-surface border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors shadow-sm cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">

          {/* Progress Summary */}
          <section className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-sm">
            <h3 className="font-headline-sm text-on-background mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-bold">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Progress Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Profile</p>
                <p className={`font-bold ${isProfileComplete ? 'text-primary' : 'text-error'}`}>{profileCompleteness}%</p>
              </div>
              <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Resume</p>
                <p className={`font-bold ${hasResume ? 'text-primary' : 'text-error'}`}>{hasResume ? 'Uploaded' : 'Missing'}</p>
              </div>
              <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Saved</p>
                <p className="font-bold text-on-background">{savedCount || 0}</p>
              </div>
              <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Applied</p>
                <p className="font-bold text-on-background">{appliedCount}</p>
              </div>
            </div>
          </section>

          {/* Recommended Next Actions */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4">
            <h3 className="font-headline-sm text-on-background mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-bold">
              <span className="material-symbols-outlined text-primary">next_plan</span>
              Recommended Next Actions
            </h3>
            {recommendations.length > 0 ? (
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <Link href={rec.link} key={rec.id} className="flex items-center gap-4 p-2 bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm">
                    <div className="w-10 h-10 bg-primary-container/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                      <span className="material-symbols-outlined">{rec.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-label-md font-bold text-on-background">{rec.title}</h4>
                      <p className="text-xs text-on-surface-variant">{rec.description}</p>
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">verified</span>
                <p className="font-label-md text-on-background font-bold">You&apos;re all caught up!</p>
                <p className="text-sm text-on-surface-variant mt-1">Explore fresh opportunities to find your next role.</p>
              </div>
            )}
          </section>

          {/* Fresh Opportunities */}
          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-2">
              <h3 className="font-headline-sm text-on-background flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-secondary">new_releases</span>
                Fresh Opportunities
              </h3>
              <Link href="/search" className="font-label-md text-primary font-medium hover:underline cursor-pointer">Explore More</Link>
            </div>
            <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
              {freshOpportunities?.filter(opp => {
                if (['Closed', 'Expired'].includes(opp.status)) return false
                if (!opp.deadline) return true
                return new Date(opp.deadline).getTime() >= new Date().getTime()
              }).map((opp) => (
                <div key={opp.id} className="snap-start shrink-0 w-full md:w-[calc(50%-0.5rem)]">
                  <OpportunitySearchCard opportunity={opp as any} maxSkills={7} className="h-full" />
                </div>
              ))}
              {freshOpportunities?.length === 0 && (
                <div className="w-full py-8 text-center text-on-surface-variant">
                  No fresh opportunities available at the moment.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-gutter">

          <DashboardAlerts initialAlerts={alerts} />

          {/* Tracker Snapshot */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4">
            <h3 className="font-headline-sm text-on-background mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-bold">
              <span className="material-symbols-outlined text-primary">view_kanban</span>
              Snapshot
            </h3>
            {hasNoTrackerItems ? (
              <div className="p-6 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest flex flex-col items-center">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">assignment</span>
                <p className="font-label-md text-on-surface-variant">Save opportunities to begin tracking.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/profile/saved" className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">bookmark</span>
                    </div>
                    <span className="font-label-md text-on-background group-hover:text-primary transition-colors">Saved for Later</span>
                  </div>
                  <span className="font-title-md font-bold text-on-background">{savedCount || 0}</span>
                </Link>

                <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    </div>
                    <span className="font-label-md text-on-background">Applied</span>
                  </div>
                  <span className="font-title-md font-bold text-on-background">{appliedCount}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[18px]">forum</span>
                    </div>
                    <span className="font-label-md text-primary font-medium">Interviewing</span>
                  </div>
                  <span className="font-title-md font-bold text-primary">{interviewCount}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <span className="font-label-md text-secondary font-medium">Offers</span>
                  </div>
                  <span className="font-title-md font-bold text-secondary">{offerCount}</span>
                </div>
              </div>
            )}
            <Link href="/tracker" className="w-full mt-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl font-label-md text-on-surface hover:bg-surface-container hover:text-primary transition-colors font-semibold cursor-pointer flex items-center justify-center gap-2">
              View Full Tracker
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </section>
        </div>
      </div>

      {/* Recently Viewed - Full Width */}
      {recentlyViewed.length > 0 && (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-2">
            <h3 className="font-headline-sm text-on-background flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-secondary">history</span>
              Recently Viewed
            </h3>
          </div>
          <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
            {recentlyViewed.map((opp: any) => (
              <div key={opp.id} className="w-[300px] md:w-[350px] lg:w-[400px] snap-start shrink-0">
                <OpportunitySearchCard opportunity={opp as any} maxSkills={7} className="h-full" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
