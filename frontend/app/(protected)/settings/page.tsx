import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'Settings | Opportunity Radar'
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col gap-xl max-w-3xl mx-auto w-full pb-16">
      <header className="mb-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-xs">
          Settings
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Manage your account preferences and security.</p>
      </header>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="border-b border-outline-variant pb-4">
          <h3 className="font-headline-sm text-on-background font-bold mb-1">Account Details</h3>
          <p className="text-sm text-on-surface-variant">Your current sign-in information.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Email Address</span>
            <span className="text-base text-on-background">{user?.email}</span>
          </div>
          <div>
            <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Password</span>
            <button disabled className="text-sm px-4 py-2 bg-surface-container border border-outline-variant text-on-surface-variant font-medium rounded-lg opacity-50 cursor-not-allowed">
              Change Password (Coming Soon)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="border-b border-outline-variant pb-4">
          <h3 className="font-headline-sm text-on-background font-bold mb-1">Privacy & Notifications</h3>
          <p className="text-sm text-on-surface-variant">Control what you share and when you are alerted.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
            <div>
              <h4 className="font-bold text-on-background">Email Alerts</h4>
              <p className="text-sm text-on-surface-variant">Receive weekly opportunity matches.</p>
            </div>
            <div className="w-12 h-6 bg-primary rounded-full relative opacity-50 cursor-not-allowed" title="Coming soon">
              <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
            <div>
              <h4 className="font-bold text-on-background">Public Profile</h4>
              <p className="text-sm text-on-surface-variant">Allow recruiters to view your resume.</p>
            </div>
            <div className="w-12 h-6 bg-surface-container-high rounded-full relative opacity-50 cursor-not-allowed" title="Coming soon">
              <div className="w-4 h-4 bg-on-surface-variant rounded-full absolute left-1 top-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
