import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NoteLinkTarget } from '@/features/notes/types'

export const runtime = 'nodejs'

const PER_TYPE_LIMIT = 5

/**
 * GET /api/notes/link-targets?q=…&exclude=<noteId>
 *
 * Powers the "link something" picker: one debounced query returns the best
 * few matches of each kind — notes, folders, opportunities, tracked
 * applications — so the picker can group them without four round trips.
 *
 * Opportunities are the only public data here; everything else is filtered to
 * the caller, so a search can never surface another student's note title.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const exclude = searchParams.get('exclude')

  if (q.length < 2) {
    return NextResponse.json({ targets: [] })
  }

  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`)
  const like = `%${escaped}%`

  let notesQuery = supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .ilike('title', like)
    .order('updated_at', { ascending: false })
    .limit(PER_TYPE_LIMIT)

  // A note is never offered as a link target for itself.
  if (exclude) notesQuery = notesQuery.neq('id', exclude)

  const [notes, folders, opportunities, applications] = await Promise.all([
    notesQuery,
    supabase
      .from('note_folders')
      .select('id, name')
      .eq('user_id', user.id)
      .ilike('name', like)
      .limit(PER_TYPE_LIMIT),
    supabase
      .from('opportunities')
      .select('id, title, companies(name)')
      .eq('status', 'Published')
      .ilike('title', like)
      .limit(PER_TYPE_LIMIT),
    supabase
      .from('application_tracker')
      .select('id, status, opportunities(title, companies(name))')
      .eq('user_id', user.id)
      .limit(50),
  ])

  const targets: NoteLinkTarget[] = []

  for (const row of notes.data ?? []) {
    targets.push({ type: 'note', id: row.id as string, label: (row.title as string) || 'Untitled', sublabel: 'Note' })
  }
  for (const row of folders.data ?? []) {
    targets.push({ type: 'folder', id: row.id as string, label: row.name as string, sublabel: 'Folder' })
  }
  for (const row of (opportunities.data ?? []) as unknown as { id: string; title: string; companies: { name: string } | null }[]) {
    targets.push({ type: 'opportunity', id: row.id, label: row.title, sublabel: row.companies?.name ?? 'Opportunity' })
  }
  // Applications are matched in JS: the searchable text lives on the joined
  // opportunity, and PostgREST cannot filter a parent row by an embedded
  // column without an inner join that would drop tracker rows whose listing
  // has since been removed.
  const applicationRows = (applications.data ?? []) as unknown as {
    id: string
    status: string
    opportunities: { title: string; companies: { name: string } | null } | null
  }[]
  const needle = q.toLowerCase()
  for (const row of applicationRows) {
    const title = row.opportunities?.title ?? ''
    if (!title.toLowerCase().includes(needle)) continue
    targets.push({
      type: 'application',
      id: row.id,
      label: title,
      sublabel: [row.opportunities?.companies?.name, row.status].filter(Boolean).join(' · ') || 'Application',
    })
    if (targets.filter((t) => t.type === 'application').length >= PER_TYPE_LIMIT) break
  }

  return NextResponse.json({ targets })
}
