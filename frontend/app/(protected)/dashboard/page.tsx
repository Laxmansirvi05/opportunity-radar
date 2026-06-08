import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import { DashboardAlerts, Alert } from '@/features/dashboard/components/dashboard-alerts'

export const metadata = {
  title: 'Command Center | Opportunity Radar',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Student'

  if (!user) return null

  // 1. Fetch Profile & Metrics
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { count: savedCount } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data: trackerItems } = await supabase
    .from('application_tracker')
    .select('status')
    .eq('user_id', user.id)

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

  // 2. Fetch Fresh Opportunities
  const { data: freshOpportunities } = await supabase
    .from('opportunities')
    .select('*, companies(*), opportunity_tags(tag_name)')
    .eq('status', 'Published')
    .order('posted_at', { ascending: false })
    .limit(4)

  // Fetch Recently Viewed
  const { data: recentViews } = await supabase
    .from('recently_viewed')
    .select('viewed_at, opportunities(*, companies(*), opportunity_tags(tag_name))')
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(10)
  
  const recentlyViewed = recentViews?.map((v: any) => v.opportunities).filter(Boolean) || []

  // 3. Compute Intelligence
  const isProfileComplete = profile && profile.university && profile.skills && profile.skills.length > 0
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

  const hasNoTrackerItems = !savedCount && appliedCount === 0 && interviewCount === 0 && offerCount === 0

  return (
    <div className="flex flex-col gap-xl">
      {/* Header Section */}
      <header className="mb-lg flex flex-col md:flex-row md:justify-between md:items-end gap-md">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-xs">
            Action Station: {displayName}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Focus on today&apos;s high-impact opportunities.</p>
        </div>
        <div className="flex gap-sm">
          <Link href="/search" className="flex-1 md:flex-none bg-primary text-on-primary font-label-md text-label-md font-semibold px-md py-sm rounded-xl hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Apply Now
          </Link>
          <button className="w-10 h-10 rounded-xl bg-surface border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors shadow-sm cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">
          
          {/* Progress Summary */}
          <section className="bg-surface border border-outline-variant rounded-2xl p-md shadow-sm">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Progress Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
              <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Profile</p>
                <p className={`font-bold ${isProfileComplete ? 'text-primary' : 'text-error'}`}>{isProfileComplete ? '100%' : '50%'}</p>
              </div>
              <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Resume</p>
                <p className={`font-bold ${hasResume ? 'text-primary' : 'text-error'}`}>{hasResume ? 'Uploaded' : 'Missing'}</p>
              </div>
              <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Saved</p>
                <p className="font-bold text-on-background">{savedCount || 0}</p>
              </div>
              <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/30 text-center">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Applied</p>
                <p className="font-bold text-on-background">{appliedCount}</p>
              </div>
            </div>
          </section>

          {/* Recommended Next Actions */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">next_plan</span>
              Recommended Next Actions
            </h3>
            {recommendations.length > 0 ? (
              <div className="space-y-sm">
                {recommendations.map((rec) => (
                  <Link href={rec.link} key={rec.id} className="flex items-center gap-md p-sm bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm">
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
                <p className="font-label-md text-on-background font-bold">You're all caught up!</p>
                <p className="text-sm text-on-surface-variant mt-1">Explore fresh opportunities to find your next role.</p>
              </div>
            )}
          </section>

          {/* Fresh Opportunities */}
          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md">
            <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
              <h3 className="font-headline-sm text-on-background flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-secondary">new_releases</span>
                Fresh Opportunities
              </h3>
              <Link href="/search" className="font-label-md text-primary font-medium hover:underline cursor-pointer">Explore More</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {freshOpportunities?.map((opp) => (
                <OpportunitySearchCard key={opp.id} opportunity={opp} />
              ))}
              {freshOpportunities?.length === 0 && (
                <div className="col-span-full py-8 text-center text-on-surface-variant">
                  No fresh opportunities available at the moment.
                </div>
              )}
            </div>
          </section>

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md">
              <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
                <h3 className="font-headline-sm text-on-background flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-secondary">history</span>
                  Recently Viewed
                </h3>
              </div>
              <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
                {recentlyViewed.map((opp: any) => (
                  <div key={opp.id} className="min-w-[300px] w-[300px] snap-start shrink-0">
                    <OpportunitySearchCard opportunity={opp} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-gutter">
          
          <DashboardAlerts initialAlerts={alerts} />

          {/* Tracker Snapshot */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">view_kanban</span>
              Snapshot
            </h3>
            {hasNoTrackerItems ? (
              <div className="p-6 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest flex flex-col items-center">
                <span className="material-symbols-outlined text-3xl text-outline mb-2">assignment</span>
                <p className="font-label-md text-on-surface-variant">Save opportunities to begin tracking.</p>
              </div>
            ) : (
              <div className="space-y-sm">
                <Link href="/profile/saved" className="flex justify-between items-center p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/50 hover:border-primary transition-colors cursor-pointer group">
                  <span className="font-label-md group-hover:text-primary transition-colors">Saved for Later</span>
                  <span className="font-bold">{savedCount || 0}</span>
                </Link>
                <div className="flex justify-between items-center p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/50">
                  <span className="font-label-md">Applied</span>
                  <span className="font-bold">{appliedCount}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-primary-container/10 rounded-lg text-primary font-bold">
                  <span>Interviewing</span>
                  <span>{interviewCount}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-secondary-container/10 rounded-lg text-secondary font-bold">
                  <span>Offers</span>
                  <span>{offerCount}</span>
                </div>
              </div>
            )}
            <Link href="/tracker" className="w-full mt-md py-sm border border-outline-variant rounded-lg font-label-md text-on-surface hover:bg-surface-container transition-colors font-medium cursor-pointer block text-center">
              View Full Tracker
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
