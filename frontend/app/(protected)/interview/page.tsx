import { createClient } from '@/lib/supabase/server'
import { InterviewStart } from '@/features/interview/components/interview-start'

export const metadata = {
  title: 'Mock Interview | Opportunity Radar',
  description: 'Practice a voice mock interview and get scored feedback.',
}

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string }>
}) {
  const { opportunity: opportunityId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let opportunity: { id: string; title: string; company: string | null; description: string | null } | null = null
  if (opportunityId) {
    const { data } = await supabase
      .from('opportunities')
      .select('id, title, description, companies(name)')
      .eq('id', opportunityId)
      .maybeSingle()
    if (data) {
      opportunity = {
        id: data.id,
        title: data.title,
        description: data.description ?? null,
        company: (data.companies as unknown as { name?: string } | null)?.name ?? null,
      }
    }
  }

  // The student's saved resumes power the "pick one" half of step 1. Fetched
  // server-side so the first paint already knows whether they have any —
  // otherwise the intake flashes an upload-only state before correcting.
  let resumes: { id: string; title: string; updated_at: string }[] = []
  if (user) {
    const { data } = await supabase
      .from('resumes')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)
    resumes = data ?? []
  }

  return <InterviewStart opportunity={opportunity} resumes={resumes} />
}
