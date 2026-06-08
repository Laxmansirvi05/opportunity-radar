import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'

export const metadata = {
  title: 'Command Center | Opportunity Radar',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Student'

  if (!user) return null

  // 1. Fetch Metrics
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

      {/* Today's Priority Section */}
      <section className="mb-gutter">
        <div className="bg-primary text-on-primary rounded-2xl p-lg shadow-sm relative overflow-hidden border-2 border-primary">
          <div className="absolute top-0 right-0 p-lg opacity-10">
            <span className="material-symbols-outlined text-[120px]">task_alt</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm mb-md flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            Today&apos;s Priority
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {/* Priority 1: Progress Tracker */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-md border border-white/20">
              <div className="flex justify-between items-center mb-sm">
                <span className="font-label-md font-bold">Apply to 3 opportunities</span>
                <span className="font-label-sm bg-white/20 px-2 py-0.5 rounded-full">1/3 Done</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-white h-full w-[33%] transition-all duration-700"></div>
              </div>
              <Link href="/search" className="block mt-md w-full bg-white text-primary font-label-md font-bold py-1.5 rounded-lg text-center hover:bg-opacity-90 transition-all">Continue Applying</Link>
            </div>
            {/* Priority 2: Urgent Alerts */}
            <div className="bg-error-container text-on-error-container rounded-xl p-md border border-error/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <span className="font-label-md font-bold">2 Deadlines Approaching</span>
                </div>
                <p className="text-xs opacity-80">Action required within 12 hours</p>
              </div>
              <button className="mt-md w-full bg-error text-white font-label-md font-bold py-1.5 rounded-lg text-center hover:bg-opacity-90 transition-all shadow-sm">View Critical Items</button>
            </div>
            {/* Priority 3: Interview Card */}
            <div className="bg-secondary-container text-on-secondary-container rounded-xl p-md border border-secondary/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
                  <span className="font-label-md font-bold">{interviewCount} Interview{interviewCount !== 1 ? 's' : ''} Pending</span>
                </div>
                <p className="text-xs opacity-80">{interviewCount > 0 ? "You have upcoming interviews." : "Keep applying to secure interviews."}</p>
              </div>
              <Link href="/tracker" className="block mt-md w-full bg-secondary text-white font-label-md font-bold py-1.5 rounded-lg text-center hover:bg-opacity-90 transition-all shadow-sm">Prep for Interview</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Actionable Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Column: Recommendations & Feed (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">
          {/* Actionable Insights Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div className="bg-surface border border-outline-variant rounded-2xl p-md flex flex-col justify-between hover:border-primary transition-all shadow-sm group">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
                <span className="font-label-sm px-2 py-1 bg-secondary-container text-on-secondary-container rounded-md font-bold">+30%</span>
              </div>
              <div className="mt-md">
                <h4 className="font-headline-sm text-on-background">Higher Response</h4>
                <p className="font-label-md text-on-surface-variant">Your application performance is 30% higher than last week&apos;s average.</p>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-2xl p-md flex flex-col justify-between hover:border-primary transition-all shadow-sm group">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">psychology</span>
                </div>
                <span className="font-label-sm px-2 py-1 bg-primary-container text-on-primary-container rounded-md font-bold">New Matches</span>
              </div>
              <div className="mt-md">
                <h4 className="font-headline-sm text-on-background">2 Perfect Roles</h4>
                <p className="font-label-md text-on-surface-variant">We found 2 roles that match 100% of your listed skills and preferences.</p>
              </div>
            </div>
          </div>

          {/* Recommended Next Actions */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">next_plan</span>
              Recommended Next Actions
            </h3>
            <div className="space-y-sm">
              <div className="flex items-center gap-md p-sm bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm">
                <div className="w-10 h-10 bg-primary-container/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-label-md font-bold text-on-background">Update your profile</h4>
                  <p className="text-xs text-on-surface-variant">Highlight your experience to match job descriptions.</p>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
              </div>
              <div className="flex items-center gap-md p-sm bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm">
                <div className="w-10 h-10 bg-primary-container/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined">forward_to_inbox</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-label-md font-bold text-on-background">Follow up on Applications</h4>
                  <p className="text-xs text-on-surface-variant">Check the status of your applied roles.</p>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
              </div>
            </div>
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
        </div>

        {/* Right Column: Analytics & Notifications (1/3) */}
        <div className="flex flex-col gap-gutter">
          
          {/* Urgent Alerts */}
          <section className="bg-surface-container-lowest border border-error/50 rounded-2xl p-md shadow-sm">
            <h3 className="font-label-md font-bold text-error mb-md flex items-center gap-2 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
              Urgent Alerts
            </h3>
            <div className="space-y-md">
              <div className="p-3 bg-error-container/10 rounded-xl border-l-4 border-error">
                <div className="flex justify-between mb-1">
                  <span className="font-label-md font-bold text-on-background">Deadline Today</span>
                  <span className="text-[10px] text-error font-bold uppercase">6h left</span>
                </div>
                <p className="text-xs text-on-surface-variant">An application window is closing soon.</p>
              </div>
            </div>
            <button className="w-full mt-md py-sm text-error font-label-md font-bold hover:bg-error-container/20 rounded-lg transition-colors">Clear All</button>
          </section>

          {/* Momentum */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">bar_chart</span>
              Momentum
              <span className="ml-auto font-label-sm text-secondary bg-secondary-container/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +12%
              </span>
            </h3>
            <div className="flex items-end justify-between h-32 mt-4 px-2">
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-8 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">M</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-16 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">T</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <span className="font-label-sm text-primary font-bold">8</span>
                <div className="w-6 bg-primary rounded-t-md h-24"></div>
                <span className="font-label-sm text-primary font-bold">W</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-4 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">T</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-10 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">F</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-1 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">S</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-6 bg-surface-container-high rounded-t-md h-1 group-hover:bg-primary transition-colors"></div>
                <span className="font-label-sm text-on-surface-variant font-medium">S</span>
              </div>
            </div>
          </section>

          {/* Tracker Snapshot */}
          <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
            <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
              <span className="material-symbols-outlined text-primary">view_kanban</span>
              Snapshot
            </h3>
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
            <Link href="/tracker" className="w-full mt-md py-sm border border-outline-variant rounded-lg font-label-md text-on-surface hover:bg-surface-container transition-colors font-medium cursor-pointer block text-center">
              View Full Tracker
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
