import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InterviewSession } from '@/features/interview/components/interview-session'

export const metadata = {
  title: 'Interview | Opportunity Radar',
}

// Reads live agent status on every load; never prerender.
export const dynamic = 'force-dynamic'

export default async function InterviewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ persona?: string }>
}) {
  const { sessionId } = await params
  const { persona } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Ownership check up front so an unauthenticated/wrong-user request 404s
  // before any client code runs, not just at the API layer.
  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session) notFound()

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <InterviewSession sessionId={sessionId} personaId={persona ?? null} />
      </div>
    </div>
  )
}
