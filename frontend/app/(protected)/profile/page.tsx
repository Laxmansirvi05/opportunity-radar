import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'User Profile | Opportunity Radar',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'U'
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Student'

  return (
    <div className="max-w-container-max mx-auto space-y-lg pb-16">
      {/* Profile Header */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col md:flex-row items-center md:items-start justify-between gap-md">
        <div className="flex flex-col md:flex-row items-center gap-lg">
          <div aria-label="Initials" className="w-24 h-24 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-display text-headline-lg">
            {initial}
          </div>
          <div className="text-center md:text-left">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{displayName}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Stanford University • B.S. Computer Science</p>
            <p className="font-label-md text-label-md text-outline">Class of 2026</p>
          </div>
        </div>
        <button className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md hover:bg-surface-tint transition-colors cursor-pointer">
          Edit Profile
        </button>
      </section>

      {/* Career Snapshot */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors cursor-pointer">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Saved</p>
          <p className="font-headline-md text-headline-md mt-xs">24</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors cursor-pointer">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Applied</p>
          <p className="font-headline-md text-headline-md mt-xs">18</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors cursor-pointer">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Interviews</p>
          <p className="font-headline-md text-headline-md mt-xs">4</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors cursor-pointer">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Success Rate</p>
          <p className="font-headline-md text-headline-md text-secondary mt-xs">82%</p>
        </div>
      </section>

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Skills & Interests */}
        <div className="lg:col-span-8 space-y-gutter">
          {/* Skills Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <div className="flex justify-between items-center mb-md">
              <h3 className="font-headline-sm text-headline-sm">Skills</h3>
              <button className="text-primary font-label-md text-label-md flex items-center gap-xs hover:underline cursor-pointer">
                <span className="material-symbols-outlined text-sm">add</span> Add Skill
              </button>
            </div>
            <div className="flex flex-wrap gap-sm">
              <span className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant">Python</span>
              <span className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant">React</span>
              <span className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant">TypeScript</span>
              <span className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant">SQL</span>
              <span className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant">Machine Learning</span>
            </div>
          </div>

          {/* Interests Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <h3 className="font-headline-sm text-headline-sm mb-md">Interests</h3>
            <div className="flex flex-wrap gap-sm">
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-primary bg-primary-container text-on-primary-container cursor-pointer">Internships</button>
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:border-primary transition-colors cursor-pointer">Jobs</button>
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-primary bg-primary-container text-on-primary-container cursor-pointer">Hackathons</button>
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:border-primary transition-colors cursor-pointer">Scholarships</button>
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:border-primary transition-colors cursor-pointer">Competitions</button>
              <button className="px-md py-sm rounded-full font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:border-primary transition-colors cursor-pointer">Workshops</button>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <h3 className="font-headline-sm text-headline-sm mb-lg">Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
              <div>
                <p className="font-label-sm text-label-sm text-outline uppercase mb-sm">Work Mode</p>
                <p className="font-body-md text-body-md text-on-surface mb-md">Remote, Hybrid, Onsite</p>
                <p className="font-label-sm text-label-sm text-outline uppercase mb-sm">Preferred Locations</p>
                <p className="font-body-md text-body-md text-on-surface mb-md">San Francisco, New York, Remote</p>
                <p className="font-label-sm text-label-sm text-outline uppercase mb-sm">Preferred Companies</p>
                <p className="font-body-md text-body-md text-on-surface">Vercel, Stripe, Airbnb, Linear</p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm text-outline uppercase mb-sm">Preferred Categories</p>
                <p className="font-body-md text-body-md text-on-surface mb-md">Software Engineering, Product Design</p>
                <p className="font-label-sm text-label-sm text-outline uppercase mb-sm">Career Goals</p>
                <p className="font-body-md text-body-md text-on-surface italic">&quot;Aiming for a Full-stack Developer role at a Series A startup&quot;</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Resume & Settings */}
        <div className="lg:col-span-4 space-y-gutter">
          {/* Resume Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl h-fit">
            <h3 className="font-headline-sm text-headline-sm mb-md">Resume</h3>
            <div className="bg-surface-container-low p-md rounded-lg flex items-center gap-sm mb-md border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-3xl">description</span>
              <div className="overflow-hidden">
                <p className="font-label-md text-label-md text-on-surface truncate">Alex_Mercer_Resume_2024.pdf</p>
                <p className="font-label-sm text-label-sm text-outline">Uploaded: Oct 12, 2023 • 245 KB</p>
                <p className="font-label-sm text-label-sm text-primary mt-xs">Last Updated: 2 days ago</p>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-1 border border-outline-variant py-sm rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors cursor-pointer">Replace</button>
              <button className="flex-1 bg-primary-container text-on-primary-container py-sm rounded-lg font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors cursor-pointer">View</button>
            </div>
          </div>

          {/* Account Settings */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden h-fit">
            <div className="p-lg pb-sm">
              <h3 className="font-headline-sm text-headline-sm">Account Settings</h3>
            </div>
            <div className="flex flex-col">
              <button className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group cursor-pointer">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">lock</span>
                  <span className="font-body-md text-body-md text-on-surface">Change Password</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group border-t border-outline-variant cursor-pointer">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">notifications_active</span>
                  <span className="font-body-md text-body-md text-on-surface">Notification Preferences</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group border-t border-outline-variant cursor-pointer">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">security</span>
                  <span className="font-body-md text-body-md text-on-surface">Privacy Settings</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden h-fit">
            <div className="p-lg pb-sm">
              <h3 className="font-headline-sm text-headline-sm">Recent Activity</h3>
            </div>
            <div className="flex flex-col divide-y divide-outline-variant">
              <div className="p-md flex items-start gap-sm hover:bg-surface-variant/50 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-primary text-sm mt-1">send</span>
                <div>
                  <p className="font-body-md text-body-md text-on-surface">Applied to <strong>Vercel</strong></p>
                  <p className="font-label-sm text-label-sm text-outline">3h ago</p>
                </div>
              </div>
              <div className="p-md flex items-start gap-sm hover:bg-surface-variant/50 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-primary text-sm mt-1">bookmark</span>
                <div>
                  <p className="font-body-md text-body-md text-on-surface">Saved 2 new opportunities</p>
                  <p className="font-label-sm text-label-sm text-outline">5h ago</p>
                </div>
              </div>
              <div className="p-md flex items-start gap-sm hover:bg-surface-variant/50 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-primary text-sm mt-1">description</span>
                <div>
                  <p className="font-body-md text-body-md text-on-surface">Updated Resume</p>
                  <p className="font-label-sm text-label-sm text-outline">1d ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
