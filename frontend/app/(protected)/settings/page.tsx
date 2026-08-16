import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DeleteAccountButton } from '@/features/settings/components/delete-account-button'
import { SettingsToggles } from '@/features/settings/components/settings-toggles'

export const metadata = {
  title: 'Settings | Opportunity Radar'
}

function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let emailAlerts = false
  let publicProfile = false
  let name: string | null = null
  let memberSince: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_alerts, public_profile, name, created_at')
      .eq('id', user.id)
      .single()

    if (profile) {
      emailAlerts = profile.email_alerts
      publicProfile = profile.public_profile
      name = profile.name
      memberSince = formatMemberSince(profile.created_at)
    }
  }

  return (
    <div className="flex flex-col gap-10 max-w-3xl mx-auto w-full pb-16">
      <header className="mb-2">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-1">
          Settings
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Manage your account preferences and security.</p>
      </header>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
          <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold">Account Details</h3>
            <p className="text-sm text-on-surface-variant">Your current sign-in information.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {name && (
            <div>
              <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Name</span>
              <div className="flex items-center justify-between gap-3">
                <span className="text-base text-on-background">{name}</span>
                <Link href="/profile" className="text-sm font-bold text-primary hover:underline shrink-0">
                  Edit Profile
                </Link>
              </div>
            </div>
          )}
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
          {memberSince && (
            <div>
              <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Member Since</span>
              <span className="text-base text-on-background">{memberSince}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
          <div className="w-10 h-10 bg-surface-container-high text-on-surface rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">shield_person</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold">Privacy & Notifications</h3>
            <p className="text-sm text-on-surface-variant">Control what you share and when you are alerted.</p>
          </div>
        </div>

        <SettingsToggles initialEmailAlerts={emailAlerts} initialPublicProfile={publicProfile} />
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
          <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">help</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold">Help & Legal</h3>
            <p className="text-sm text-on-surface-variant">Get support or review our policies.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/support" className="flex items-center justify-between gap-2 px-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl hover:bg-surface-container-low transition-colors">
            <span className="text-sm font-medium text-on-background">Support</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
          </Link>
          <Link href="/privacy" className="flex items-center justify-between gap-2 px-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl hover:bg-surface-container-low transition-colors">
            <span className="text-sm font-medium text-on-background">Privacy Policy</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
          </Link>
          <Link href="/terms" className="flex items-center justify-between gap-2 px-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl hover:bg-surface-container-low transition-colors">
            <span className="text-sm font-medium text-on-background">Terms of Service</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
          </Link>
        </div>
      </div>

      <div className="bg-surface border border-error/30 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-3 border-b border-error/20 pb-4">
          <div className="w-10 h-10 bg-error-container text-on-error-container rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">warning</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-error font-bold">Danger Zone</h3>
            <p className="text-sm text-on-surface-variant">Permanent account actions.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="block text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Delete Account</span>
            <p className="text-sm text-on-surface-variant mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </div>
  )
}
