import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFolderColor, type FolderColor, type NoteFolder, type NotePreview } from '@/features/notes/types'
import { toSnippet } from '@/features/notes/lib/note-preview'

export const runtime = 'nodejs'

const NAME_MAX = 60
const PREVIEWS_PER_FOLDER = 5
/**
 * How many recent notes are scanned to build folder previews. Bounded on
 * purpose — previews are decoration on a folder card, and a student with
 * 2,000 notes should not pay for all of them to draw a grid. Folders whose
 * newest note falls outside this window simply show fewer previews; the
 * note_count beside them is still exact, because that comes from SQL.
 */
const PREVIEW_SCAN_LIMIT = 300

const DEFAULT_FOLDERS: { name: string; color: FolderColor }[] = [
  { name: 'Skills', color: 'purple' },
  { name: 'Opportunities', color: 'green' },
  { name: 'General', color: 'neutral' },
]

/** Postgres unique_violation — thrown when a folder name collides with one the caller already has. */
const PG_UNIQUE_VIOLATION = '23505'

const FOLDER_COLUMNS = 'id, name, color, icon, parent_id, position'

interface FolderRow {
  id: string
  name: string
  color: FolderColor
  icon: string | null
  parent_id: string | null
  position: number
}

interface PreviewRow {
  id: string
  folder_id: string | null
  title: string
  preview_html: string | null
  first_image_url: string | null
  updated_at: string
  is_pinned: boolean
}

/**
 * GET /api/notes/folders
 *
 * Lists the caller's folders with an exact note count and up to 5 preview
 * notes each — the data the 3D folder cards fan out on hover.
 *
 * Users who somehow still have zero folders (e.g. they signed up after the
 * backfill migration ran) get the same defaults seeded lazily here —
 * belt-and-suspenders with the migration's one-time backfill, matching this
 * codebase's existing pattern of never relying on a single seeding path.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let { data: folders, error } = await supabase
    .from('note_folders')
    .select(FOLDER_COLUMNS)
    .eq('user_id', user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Notes] Failed to list folders:', error)
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 })
  }

  if ((folders ?? []).length === 0) {
    const { error: seedError } = await supabase
      .from('note_folders')
      .insert(DEFAULT_FOLDERS.map((folder, index) => ({
        user_id: user.id,
        name: folder.name,
        color: folder.color,
        position: index,
      })))
    if (seedError) {
      console.error('[Notes] Failed to seed default folders:', seedError)
      return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 })
    }
    ;({ data: folders, error } = await supabase
      .from('note_folders')
      .select(FOLDER_COLUMNS)
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }))
    if (error) {
      console.error('[Notes] Failed to reload folders after seeding:', error)
      return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 })
    }
  }

  const [counts, previews] = await Promise.all([
    supabase
      .from('note_folder_counts')
      .select('folder_id, note_count')
      .eq('user_id', user.id),
    supabase
      .from('note_preview_rows')
      .select('id, folder_id, title, preview_html, first_image_url, updated_at, is_pinned')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(PREVIEW_SCAN_LIMIT),
  ])

  if (counts.error) console.error('[Notes] Failed to load folder counts:', counts.error)
  if (previews.error) console.error('[Notes] Failed to load folder previews:', previews.error)

  const countByFolder = new Map<string, number>(
    (counts.data ?? []).map((row) => [row.folder_id as string, row.note_count as number])
  )

  const previewsByFolder = new Map<string, NotePreview[]>()
  for (const row of (previews.data ?? []) as PreviewRow[]) {
    if (!row.folder_id) continue
    const bucket = previewsByFolder.get(row.folder_id) ?? []
    if (bucket.length >= PREVIEWS_PER_FOLDER) continue
    bucket.push({
      id: row.id,
      title: row.title,
      snippet: toSnippet(row.preview_html ?? ''),
      image_url: row.first_image_url,
      updated_at: row.updated_at,
      is_pinned: row.is_pinned,
    })
    previewsByFolder.set(row.folder_id, bucket)
  }

  const result: NoteFolder[] = ((folders ?? []) as FolderRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    parent_id: row.parent_id,
    position: row.position,
    note_count: countByFolder.get(row.id) ?? 0,
    previews: previewsByFolder.get(row.id) ?? [],
  }))

  return NextResponse.json({ folders: result })
}

/**
 * POST /api/notes/folders
 *
 * Creates a folder. Body: { name, color?, icon?, parent_id? }. A duplicate
 * name (per the DB's own unique(user_id, name) constraint) returns a clean
 * 409 instead of a raw Postgres error.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: unknown; color?: unknown; icon?: unknown; parent_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, NAME_MAX) : ''
  if (!name) {
    return NextResponse.json({ error: 'A folder needs a name' }, { status: 400 })
  }

  const color: FolderColor = isFolderColor(body.color) ? body.color : 'blue'
  const icon = typeof body.icon === 'string' ? body.icon.slice(0, 40) : null
  let parent_id = typeof body.parent_id === 'string' ? body.parent_id : null

  if (parent_id) {
    const { data: owned } = await supabase
      .from('note_folders')
      .select('id')
      .eq('id', parent_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!owned) parent_id = null
  }

  // New folders land at the end of their own level rather than jumping to the
  // top of a manually ordered list.
  const { data: last } = await supabase
    .from('note_folders')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('note_folders')
    .insert({ user_id: user.id, name, color, icon, parent_id, position: (last?.position ?? -1) + 1 })
    .select(FOLDER_COLUMNS)
    .single()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: 'A folder with that name already exists' }, { status: 409 })
    }
    console.error('[Notes] Failed to create folder:', error)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }

  const row = data as FolderRow
  const folder: NoteFolder = { ...row, note_count: 0, previews: [] }
  return NextResponse.json({ folder })
}

/**
 * PATCH /api/notes/folders
 *
 * Bulk reorder after a drag. Body: { order: [{ id, position, parent_id? }] }.
 *
 * One request rather than one PATCH per folder: dragging one folder shifts
 * every folder after it, so per-folder requests would mean a burst of writes
 * that can interleave and land out of order.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { order?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json({ error: 'Nothing to reorder' }, { status: 400 })
  }

  const entries = body.order
    .filter((entry): entry is { id: string; position: number; parent_id?: string | null } =>
      typeof entry === 'object' && entry !== null
      && typeof (entry as { id?: unknown }).id === 'string'
      && typeof (entry as { position?: unknown }).position === 'number')
    .slice(0, 500)

  if (entries.length === 0) {
    return NextResponse.json({ error: 'Nothing to reorder' }, { status: 400 })
  }

  // Every update carries .eq('user_id') so a forged id in the payload updates
  // nothing rather than reordering somebody else's folders.
  const results = await Promise.all(entries.map((entry) => {
    const patch: Record<string, unknown> = { position: entry.position }
    if ('parent_id' in entry) {
      // A folder cannot be its own parent — the DB has no constraint for it,
      // and the tree renderer would recurse forever.
      patch.parent_id = entry.parent_id === entry.id ? null : entry.parent_id ?? null
    }
    return supabase.from('note_folders').update(patch).eq('id', entry.id).eq('user_id', user.id)
  }))

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    console.error('[Notes] Failed to reorder folders:', failed.error)
    return NextResponse.json({ error: 'Failed to reorder folders' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
