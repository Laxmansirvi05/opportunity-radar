import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layouts/dashboard-header'
import { DashboardSidebar } from '@/components/layouts/dashboard-sidebar'
import { MobileBottomNav } from '@/components/layouts/mobile-bottom-nav'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // This is the authoritative auth gate for every route in this group.
  // Proxy performs the same check optimistically, but per the Next.js docs it
  // must never be relied on alone — this is the one that actually protects data.
  if (!user) {
    redirect('/login')
  }

  let avatarUrl: string | null = null
  let userName: string | null = user.user_metadata?.full_name || null

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url, name')
    .eq('id', user.id)
    .single()

  if (profile) {
    avatarUrl = profile.avatar_url
    if (profile.name) {
      userName = profile.name
    }
  }

  return (
    <div className="flex min-h-screen bg-surface-container-low">
      <DashboardSidebar user={user} avatarUrl={avatarUrl} userName={userName} />
      <div className="flex-1 flex flex-col min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom)+16px)] md:pb-0">
        <DashboardHeader user={user} avatarUrl={avatarUrl} userName={userName} />
        {/* min-h-0 lets full-height children (search, tracker) own their own
            scrolling instead of overflowing this container and leaving a dead
            band of layout padding beneath the last card. */}
        <main className="flex-1 min-h-0 p-margin-mobile md:p-gutter max-w-container-max mx-auto w-full overflow-x-hidden gap-10">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
