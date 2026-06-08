import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DeleteAccountButton } from '@/features/settings/components/delete-account-button'
import { SettingsToggles } from '@/features/settings/components/settings-toggles'

export const metadata = {
  title: 'Settings | Opportunity Radar'
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let emailAlerts = false
  let publicProfile = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_alerts, public_profile')
      .eq('id', user.id)
      .single()
      
    if (profile) {
      emailAlerts = profile.email_alerts
      publicProfile = profile.public_profile
    }
  }

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
            <Link href="/forgot-password" className="inline-block text-sm px-4 py-2 bg-surface-container border border-outline-variant text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors">
              Reset Password
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="border-b border-outline-variant pb-4">
          <h3 className="font-headline-sm text-error font-bold mb-1">Danger Zone</h3>
          <p className="text-sm text-on-surface-variant">Permanent account actions.</p>
        </div>
        
        <div className="flex flex-col gap-4">
          <div>
            <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Delete Account</span>
            <p className="text-sm text-on-surface-variant mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>
            <DeleteAccountButton />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="border-b border-outline-variant pb-4">
          <h3 className="font-headline-sm text-on-background font-bold mb-1">Privacy & Notifications</h3>
          <p className="text-sm text-on-surface-variant">Control what you share and when you are alerted.</p>
        </div>

        <SettingsToggles initialEmailAlerts={emailAlerts} initialPublicProfile={publicProfile} />
      </div>
    </div>
  )
}
