import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTE_ATTACHMENT_BUCKET } from '@/features/notes/lib/delete-note-attachments'

export const runtime = 'nodejs'

const MAX_SIZE = 20 * 1024 * 1024

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/zip': 'zip',
}

/** Strips path separators and control characters out of a user-supplied filename. */
function safeName(name: string): string {
  return name
    .replace(/[/\\]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120) || 'attachment'
}

/**
 * POST /api/notes/upload
 *
 * Uploads a single image or document into the `note-attachments` bucket and
 * returns its public URL — used by the editor's toolbar, by drag-and-drop,
 * by pasting a screenshot, and by the drawing block's PNG export.
 *
 * Separate from the notes API itself for the same reason as /api/hub/upload:
 * a slow upload should not block autosave of the surrounding text.
 *
 * `note_id` is optional because the editor can legitimately upload before the
 * note exists — the Quick Note composer creates its row on first keystroke,
 * and an image pasted into a brand-new note can land first. Those rows are
 * adopted by the note as soon as it has an id (see PATCH /api/notes/[id]).
 *
 * SVG is accepted for images but is served from a bucket on the Supabase
 * storage origin, not this app's origin, so a script inside one cannot reach
 * this app's cookies or DOM.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  const noteIdRaw = formData?.get('note_id')
  const noteId = typeof noteIdRaw === 'string' && noteIdRaw ? noteIdRaw : null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const isImage = file.type in IMAGE_TYPES
  const isFile = file.type in FILE_TYPES
  if (!isImage && !isFile) {
    return NextResponse.json(
      { error: 'Upload an image, PDF, document, spreadsheet, or text file.' },
      { status: 422 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Attachments must be under 20MB.' }, { status: 422 })
  }

  const extension = isImage ? IMAGE_TYPES[file.type] : FILE_TYPES[file.type]
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(NOTE_ATTACHMENT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    console.error('[Notes] Attachment upload failed:', error)
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }

  const { data: publicUrlData } = supabase.storage.from(NOTE_ATTACHMENT_BUCKET).getPublicUrl(path)
  const url = publicUrlData.publicUrl

  // Ownership-checked before it is recorded, so a forged note_id cannot
  // attach a file to somebody else's note.
  let ownedNoteId: string | null = null
  if (noteId) {
    const { data: owned } = await supabase
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .maybeSingle()
    ownedNoteId = owned ? noteId : null
  }

  const { data: attachment, error: rowError } = await supabase
    .from('note_attachments')
    .insert({
      user_id: user.id,
      note_id: ownedNoteId,
      storage_path: path,
      url,
      name: safeName(file.name),
      mime_type: file.type,
      size_bytes: file.size,
      kind: isImage ? 'image' : 'file',
    })
    .select('id')
    .single()

  if (rowError) {
    // The upload itself succeeded, so the editor can still insert the file —
    // only the Attachments view's bookkeeping is missing. Failing the request
    // here would throw away a file the user can see was uploaded.
    console.error('[Notes] Failed to record attachment:', rowError)
  }

  return NextResponse.json(
    {
      url,
      id: attachment?.id ?? null,
      name: safeName(file.name),
      mime_type: file.type,
      size_bytes: file.size,
      kind: isImage ? 'image' : 'file',
    },
    { status: 201 }
  )
}
