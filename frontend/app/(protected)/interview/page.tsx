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

  let opportunity: { id: string; title: string; company: string | null } | null = null
  if (opportunityId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('opportunities')
      .select('id, title, companies(name)')
      .eq('id', opportunityId)
      .maybeSingle()
    if (data) {
      opportunity = {
        id: data.id,
        title: data.title,
        company: (data.companies as unknown as { name?: string } | null)?.name ?? null,
      }
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <InterviewStart opportunity={opportunity} />
    </div>
  )
}
