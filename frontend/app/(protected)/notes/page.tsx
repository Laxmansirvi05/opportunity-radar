import { createClient } from '@/lib/supabase/server'
import { NotesWorkspace } from '@/features/notes/components/notes-workspace'
import { NOTE_SELECT_COLUMNS, toNote, type NoteRow } from '@/features/notes/lib/to-note'
import { toSnippet } from '@/features/notes/lib/note-preview'
import type { FolderColor, NoteFolder, NotePreview } from '@/features/notes/types'

export const metadata = {
  title: 'Notes | Opportunity Radar',
}

const PREVIEWS_PER_FOLDER = 5
const PREVIEW_SCAN_LIMIT = 300

/**
 * Server-renders the default view — every note plus the folder grid — so the
 * workspace paints with real content instead of a spinner. Every later view
 * change goes through /api/notes from the client.
 *
 * The folder previews are built from note_preview_rows (truncated content)
 * rather than the notes table, for the same reason as the folders API: a
 * folder card needs 400 characters, not the whole document.
 */
export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [notesResult, foldersResult, countsResult, previewsResult] = await Promise.all([
    supabase
      .from('notes')
      .select(NOTE_SELECT_COLUMNS)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('note_folders')
      .select('id, name, color, icon, parent_id, position')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
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

  const initialNotes = (notesResult.data ?? []).map((row) => toNote(row as unknown as NoteRow))

  const countByFolder = new Map<string, number>(
    (countsResult.data ?? []).map((row) => [row.folder_id as string, row.note_count as number])
  )

  const previewsByFolder = new Map<string, NotePreview[]>()
  for (const row of previewsResult.data ?? []) {
    const folderId = row.folder_id as string | null
    if (!folderId) continue
    const bucket = previewsByFolder.get(folderId) ?? []
    if (bucket.length >= PREVIEWS_PER_FOLDER) continue
    bucket.push({
      id: row.id as string,
      title: row.title as string,
      snippet: toSnippet((row.preview_html as string) ?? ''),
      image_url: (row.first_image_url as string) ?? null,
      updated_at: row.updated_at as string,
      is_pinned: row.is_pinned as boolean,
    })
    previewsByFolder.set(folderId, bucket)
  }

  const initialFolders: NoteFolder[] = (foldersResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    color: row.color as FolderColor,
    icon: row.icon as string | null,
    parent_id: row.parent_id as string | null,
    position: row.position as number,
    note_count: countByFolder.get(row.id as string) ?? 0,
    previews: previewsByFolder.get(row.id as string) ?? [],
  }))

  return <NotesWorkspace initialNotes={initialNotes} initialFolders={initialFolders} />
}
