import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrackerBoard, type TrackerItem } from '@/features/tracker/components/tracker-board'

export const metadata = {
  title: 'Application Tracker | Opportunity Radar',
}

export default async function TrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('application_tracker')
    .select(`
      id,
      status,
      notes,
      saved_at,
      applied_at,
      updated_at,
      opportunities (
        id,
        title,
        location,
        mode,
        category,
        deadline,
        status,
        apply_url,
        salary_range,
        companies ( id, name, logo_url )
      )
    `)
    // Explicit ownership filter alongside RLS.
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[Tracker] load failed:', error.message)
  }

  /** Supabase types an embedded one-to-one join loosely; narrow it here. */
  type JoinedOpportunity = {
    id?: string
    title?: string
    location?: string | null
    mode?: string | null
    category?: string | null
    deadline?: string | null
    status?: string | null
    apply_url?: string | null
    salary_range?: string | null
    companies?: { id?: string; name?: string; logo_url?: string | null } | null
  }

  const items: TrackerItem[] = (data ?? []).map((row) => {
    const opp = ((row as Record<string, unknown>).opportunities ?? {}) as JoinedOpportunity
    return {
      id: row.id,
      status: row.status,
      notes: row.notes ?? null,
      saved_at: row.saved_at,
      applied_at: row.applied_at ?? null,
      updated_at: row.updated_at ?? row.saved_at,
      opportunity_id: opp.id ?? null,
      title: opp.title ?? 'Untitled opportunity',
      location: opp.location ?? null,
      mode: opp.mode ?? null,
      category: opp.category ?? null,
      deadline: opp.deadline ?? null,
      salary_range: opp.salary_range ?? null,
      apply_url: opp.apply_url ?? null,
      // Reconciliation deletes an expired listing unless the student has
      // progressed past "Saved"; those survive marked Expired, so the board
      // can tell them the posting has closed rather than leaving them guessing.
      listing_closed: ['Expired', 'Closed'].includes(opp.status ?? ''),
      company_name: opp.companies?.name ?? 'Unknown company',
      company_logo: opp.companies?.logo_url ?? null,
    }
  })

  return <TrackerBoard initialData={items} />
}
