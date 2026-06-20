import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ResumeSidebar } from '@/app/(resume)/_components/resume-sidebar'

export default async function ResumeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Reactive Resume Style Layout
  return (
    <SidebarProvider>
      <ResumeSidebar user={user} />
      <main className="flex-1 w-full flex flex-col overflow-hidden @container bg-background">
        {children}
      </main>
    </SidebarProvider>
  )
}
