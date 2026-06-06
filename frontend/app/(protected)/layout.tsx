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

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-surface-container-low">
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom)+16px)] md:pb-0">
        <DashboardHeader user={user} />
        <main className="flex-1 p-margin-mobile md:p-gutter max-w-container-max mx-auto w-full overflow-x-hidden gap-xl">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
