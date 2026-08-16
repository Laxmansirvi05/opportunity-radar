import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NoteSource, NoteSort, NoteView, SharePermission } from '@/features/notes/types'
import { NOTE_SELECT_COLUMNS, toNote, type NoteRow } from '@/features/notes/lib/to-note'
import { sanitizeNoteContent } from '@/features/notes/lib/sanitize-note-content'
import { hasAttachmentMarkup } from '@/features/notes/lib/note-preview'

export const runtime = 'nodejs'

const TITLE_MAX = 200
const CONTENT_MAX = 200000
const RECENT_LIMIT = 30

const VIEWS: NoteView[] = ['all', 'recent', 'pinned', 'shared', 'attachments', 'trash', 'archived']
const SORTS: NoteSort[] = ['updated', 'created', 'alphabetical']

function parseView(raw: string | null): NoteView {
  return VIEWS.includes(raw as NoteView) ? (raw as NoteView) : 'all'
}

function parseSort(raw: string | null): NoteSort {
  return SORTS.includes(raw as NoteSort) ? (raw as NoteSort) : 'updated'
}

/**
 * GET /api/notes
 *
 * Lists the caller's own notes (RLS-scoped, but every query below still
 * carries an explicit .eq('user_id', ...) — belt-and-suspenders, matching
 * this codebase's own established pattern of never trusting RLS alone). The
 * one exception is view=shared, which is by definition *not* the caller's own
 * notes and so is fetched by id from an ownership list built first.
 *
 * Query params:
 *   q          — search title/content (case-insensitive substring). Ignores
 *                folder_id, matching how Apple/Google Notes search behaves —
 *                a folder selection only filters browsing, not search.
 *   view       — all | recent | pinned | shared | trash | archived
 *   folder_id  — a folder's id, or the literal 'unfiled' for notes with no
 *                folder. Omitted means "every folder" (default browsing).
 *   sort       — updated | created | alphabetical
 *   tag        — restrict to notes carrying this tag
 *   attachments— 'true' to return only notes containing an image or file
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const view = parseView(searchParams.get('view'))
  const sort = parseSort(searchParams.get('sort'))
  const folderId = searchParams.get('folder_id')
  const tag = searchParams.get('tag')?.trim()
  const attachmentsOnly = searchParams.get('attachments') === 'true'

  if (view === 'shared') {
    return listSharedWithMe(supabase, user.id, q)
  }

  let query = supabase
    .from('notes')
    .select(NOTE_SELECT_COLUMNS)
    .eq('user_id', user.id)

  // Trash is the one view that wants the soft-deleted rows; every other view
  // must exclude them, or a deleted note would keep showing up everywhere.
  if (view === 'trash') {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  if (view === 'archived') {
    query = query.eq('is_archived', true)
  } else if (view !== 'trash') {
    query = query.eq('is_archived', false)
  }

  if (view === 'pinned') {
    query = query.eq('is_pinned', true)
  }

  // Pinned-first everywhere except Recent, which is explicitly "what did I
  // touch last" — pinning something months ago shouldn't outrank that.
  if (view !== 'recent') {
    query = query.order('is_pinned', { ascending: false })
  }
  if (sort === 'alphabetical') {
    query = query.order('title', { ascending: true })
  } else if (sort === 'created') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  if (view === 'recent') {
    query = query.limit(RECENT_LIMIT)
  }

  if (folderId === 'unfiled') {
    query = query.is('folder_id', null)
  } else if (folderId) {
    query = query.eq('folder_id', folderId)
  }
  if (tag) {
    query = query.contains('tags', [tag])
  }
  if (q) {
    const escaped = q.replace(/[%_]/g, (c) => `\\${c}`)
    query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Notes] Failed to list notes:', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }

  let notes = (data ?? []).map((row) => toNote(row as unknown as NoteRow))

  // Filtered here rather than in SQL: "has an attachment" means the document
  // markup contains an image or file node, which Postgres would have to
  // pattern-match across the whole content column on every request.
  if (attachmentsOnly) {
    notes = notes.filter((note) => hasAttachmentMarkup(note.content))
  }

  return NextResponse.json({ notes })
}

/**
 * Notes other people shared with this user.
 *
 * Two steps on purpose: the recipient rows carry the permission, and reading
 * them first means the notes query is a plain id lookup whose access is
 * enforced by the notes_select_shared_with_me policy — rather than trying to
 * express "someone else's note, but shared with me" as one filtered query.
 */
async function listSharedWithMe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  q: string | undefined
) {
  const { data: shares, error: shareError } = await supabase
    .from('note_share_recipients')
    .select('note_id, permission')
    .eq('recipient_id', userId)

  if (shareError) {
    console.error('[Notes] Failed to list shares:', shareError)
    return NextResponse.json({ error: 'Failed to load shared notes' }, { status: 500 })
  }
  if (!shares || shares.length === 0) {
    return NextResponse.json({ notes: [] })
  }

  const permissionByNote = new Map<string, SharePermission>(
    shares.map((s) => [s.note_id as string, s.permission as SharePermission])
  )

  let query = supabase
    .from('notes')
    .select(NOTE_SELECT_COLUMNS)
    .in('id', [...permissionByNote.keys()])
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (q) {
    const escaped = q.replace(/[%_]/g, (c) => `\\${c}`)
    query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Notes] Failed to load shared notes:', error)
    return NextResponse.json({ error: 'Failed to load shared notes' }, { status: 500 })
  }

  const notes = (data ?? []).map((row) => {
    const typed = row as unknown as NoteRow
    return toNote(typed, permissionByNote.get(typed.id) ?? 'view')
  })

  return NextResponse.json({ notes })
}

/**
 * POST /api/notes
 *
 * Creates a note. Body: { title?, content?, source, opportunity_id?,
 * application_id?, folder_id?, tags? }.
 *
 * Rejects an all-empty note before it ever reaches the database — the DB's
 * own check constraint (notes_not_empty) is the real backstop, but failing
 * here gives a clean 400 instead of a raw Postgres constraint error, and
 * this is exactly the path the Quick Note composer's first-keystroke draft
 * creation goes through, so it needs to be a normal, expected response.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    title?: unknown
    content?: unknown
    source?: unknown
    opportunity_id?: unknown
    application_id?: unknown
    folder_id?: unknown
    tags?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.slice(0, TITLE_MAX) : ''
  const content = sanitizeNoteContent(typeof body.content === 'string' ? body.content.slice(0, CONTENT_MAX) : '')
  const source: NoteSource = body.source === 'robot' ? 'robot' : 'manual'
  const opportunity_id = typeof body.opportunity_id === 'string' ? body.opportunity_id : null
  let application_id = typeof body.application_id === 'string' ? body.application_id : null
  let folder_id = typeof body.folder_id === 'string' ? body.folder_id : null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string').slice(0, 20) : []

  if (!title.trim() && !content.trim()) {
    return NextResponse.json({ error: 'A note needs a title or content' }, { status: 400 })
  }

  // application_tracker rows have no per-user visibility restriction baked
  // into the notes table's own FK — verify it's actually this user's own
  // tracker row rather than trusting an unvalidated client-supplied id.
  if (application_id) {
    const { data: owned } = await supabase
      .from('application_tracker')
      .select('id')
      .eq('id', application_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!owned) application_id = null
  }

  // Same belt-and-suspenders ownership check for folder_id.
  if (folder_id) {
    const { data: owned } = await supabase
      .from('note_folders')
      .select('id')
      .eq('id', folder_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!owned) folder_id = null
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: title.trim(),
      content,
      source,
      opportunity_id,
      application_id,
      folder_id,
      tags,
    })
    .select(NOTE_SELECT_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[Notes] Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  return NextResponse.json({ note: toNote(data as unknown as NoteRow) })
}
