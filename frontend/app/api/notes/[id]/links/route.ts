import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NoteLink, NoteLinkTarget, NoteLinkTargetType } from '@/features/notes/types'

export const runtime = 'nodejs'

const TARGET_TYPES: NoteLinkTargetType[] = ['note', 'folder', 'opportunity', 'application']

interface LinkRow {
  id: string
  target_type: NoteLinkTargetType
  target_id: string
}

/**
 * Resolves each link's target to something displayable, in one query per
 * type rather than one per link.
 *
 * A target that no longer exists resolves to a null label instead of being
 * dropped: the reference genuinely was made, and silently vanishing rows
 * would leave the user wondering whether the link was ever saved. The UI
 * renders those as unavailable.
 */
async function resolveTargets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: LinkRow[]
): Promise<Map<string, { label: string; sublabel: string | null }>> {
  const resolved = new Map<string, { label: string; sublabel: string | null }>()
  const idsOf = (type: NoteLinkTargetType) =>
    rows.filter((row) => row.target_type === type).map((row) => row.target_id)

  const noteIds = idsOf('note')
  const folderIds = idsOf('folder')
  const opportunityIds = idsOf('opportunity')
  const applicationIds = idsOf('application')

  const [notes, folders, opportunities, applications] = await Promise.all([
    noteIds.length
      ? supabase.from('notes').select('id, title').eq('user_id', userId).in('id', noteIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    folderIds.length
      ? supabase.from('note_folders').select('id, name').eq('user_id', userId).in('id', folderIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    opportunityIds.length
      ? supabase.from('opportunities').select('id, title, companies(name)').in('id', opportunityIds)
      : Promise.resolve({ data: [] as { id: string; title: string; companies: { name: string } | null }[] }),
    applicationIds.length
      ? supabase
          .from('application_tracker')
          .select('id, status, opportunities(title, companies(name))')
          .eq('user_id', userId)
          .in('id', applicationIds)
      : Promise.resolve({ data: [] as { id: string; status: string; opportunities: { title: string; companies: { name: string } | null } | null }[] }),
  ])

  for (const row of notes.data ?? []) {
    resolved.set(`note:${row.id}`, { label: row.title || 'Untitled', sublabel: null })
  }
  for (const row of folders.data ?? []) {
    resolved.set(`folder:${row.id}`, { label: row.name, sublabel: 'Folder' })
  }
  for (const row of (opportunities.data ?? []) as { id: string; title: string; companies: { name: string } | null }[]) {
    resolved.set(`opportunity:${row.id}`, { label: row.title, sublabel: row.companies?.name ?? null })
  }
  for (const row of (applications.data ?? []) as { id: string; status: string; opportunities: { title: string; companies: { name: string } | null } | null }[]) {
    resolved.set(`application:${row.id}`, {
      label: row.opportunities?.title ?? 'Application',
      sublabel: [row.opportunities?.companies?.name, row.status].filter(Boolean).join(' · ') || null,
    })
  }

  return resolved
}

async function readLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noteId: string
): Promise<NoteLink[]> {
  const { data } = await supabase
    .from('note_links')
    .select('id, target_type, target_id')
    .eq('user_id', userId)
    .eq('source_note_id', noteId)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as LinkRow[]
  const resolved = await resolveTargets(supabase, userId, rows)

  return rows.map((row) => {
    const hit = resolved.get(`${row.target_type}:${row.target_id}`)
    const target: NoteLinkTarget = {
      type: row.target_type,
      id: row.target_id,
      label: hit?.label ?? null,
      sublabel: hit?.sublabel ?? null,
    }
    return { id: row.id, target }
  })
}

/** GET /api/notes/[id]/links — this note's outgoing references, resolved for display. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Missing note id' }, { status: 400 })

  return NextResponse.json({ links: await readLinks(supabase, user.id, id) })
}

/**
 * POST /api/notes/[id]/links — link this note to something.
 * Body: { target_type, target_id }.
 *
 * Nothing is copied. The link stores an id, so the referenced note stays the
 * single source of truth and editing it updates every note pointing at it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Missing note id' }, { status: 400 })

  let body: { target_type?: unknown; target_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const targetType = body.target_type as NoteLinkTargetType
  const targetId = typeof body.target_id === 'string' ? body.target_id : ''

  if (!TARGET_TYPES.includes(targetType) || !targetId) {
    return NextResponse.json({ error: 'Invalid link target' }, { status: 400 })
  }
  if (targetType === 'note' && targetId === id) {
    return NextResponse.json({ error: 'A note cannot link to itself' }, { status: 400 })
  }

  const { data: owned } = await supabase
    .from('notes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!owned) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  // Everything except an opportunity is per-user data, so the target has to
  // be checked too — otherwise a note could hold a reference to another
  // user's note or folder, and the resolver would leak its title.
  if (targetType !== 'opportunity') {
    const table = targetType === 'note' ? 'notes' : targetType === 'folder' ? 'note_folders' : 'application_tracker'
    const { data: target } = await supabase
      .from(table)
      .select('id')
      .eq('id', targetId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'Link target not found' }, { status: 404 })
    }
  }

  const { error } = await supabase
    .from('note_links')
    .upsert(
      { user_id: user.id, source_note_id: id, target_type: targetType, target_id: targetId },
      { onConflict: 'source_note_id,target_type,target_id' }
    )

  if (error) {
    console.error('[Notes] Failed to create link:', error)
    return NextResponse.json({ error: 'Failed to add link' }, { status: 500 })
  }

  return NextResponse.json({ links: await readLinks(supabase, user.id, id) })
}

/** DELETE /api/notes/[id]/links?link_id=… */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const linkId = new URL(req.url).searchParams.get('link_id')
  if (!linkId) {
    return NextResponse.json({ error: 'Missing link id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('note_links')
    .delete()
    .eq('id', linkId)
    .eq('user_id', user.id)
    .eq('source_note_id', id)

  if (error) {
    console.error('[Notes] Failed to delete link:', error)
    return NextResponse.json({ error: 'Failed to remove link' }, { status: 500 })
  }

  return NextResponse.json({ links: await readLinks(supabase, user.id, id) })
}
