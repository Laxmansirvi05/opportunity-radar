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
  let { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // redirect('/login')
    user = { id: 'mock', email: 'test@example.com' } as any
  }
  let avatarUrl: string | null = null
  let userName: string | null = user?.user_metadata?.full_name || null

  if (user && user.id !== 'mock') {
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
  }

  return (
    <div className="flex min-h-screen bg-surface-container-low">
      <DashboardSidebar user={user} avatarUrl={avatarUrl} userName={userName} />
      <div className="flex-1 flex flex-col min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom)+16px)] md:pb-0">
        <DashboardHeader user={user} avatarUrl={avatarUrl} userName={userName} />
        <main className="flex-1 p-margin-mobile md:p-gutter max-w-container-max mx-auto w-full overflow-x-hidden gap-xl">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
