import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NoteAttachment } from '@/features/notes/types'
import { NOTE_ATTACHMENT_BUCKET } from '@/features/notes/lib/delete-note-attachments'

export const runtime = 'nodejs'

const LIMIT = 200

/**
 * GET /api/notes/attachments
 *
 * Every image and file the caller has uploaded into a note, newest first —
 * the Attachments view. Each row carries the note it belongs to so the view
 * can link back to it; an attachment whose note was permanently deleted is
 * cleaned up at delete time, so a null note here only ever means the upload
 * never got attached to a saved note.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const kind = new URL(req.url).searchParams.get('kind')

  let query = supabase
    .from('note_attachments')
    .select('id, note_id, url, storage_path, name, mime_type, size_bytes, kind, created_at, notes(title)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (kind === 'image' || kind === 'file') {
    query = query.eq('kind', kind)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Notes] Failed to list attachments:', error)
    return NextResponse.json({ error: 'Failed to load attachments' }, { status: 500 })
  }

  const attachments: NoteAttachment[] = (data ?? []).map((row) => {
    const note = (row as unknown as { notes?: { title: string } | null }).notes
    return {
      id: row.id as string,
      note_id: row.note_id as string | null,
      note_title: note?.title ?? null,
      url: row.url as string,
      storage_path: row.storage_path as string,
      name: row.name as string,
      mime_type: row.mime_type as string,
      size_bytes: Number(row.size_bytes ?? 0),
      kind: row.kind as 'image' | 'file',
      created_at: row.created_at as string,
    }
  })

  return NextResponse.json({ attachments })
}

/**
 * DELETE /api/notes/attachments?id=…
 *
 * Removes the stored object and its row. The note's own markup is left
 * alone: rewriting someone's document from a file-manager action would be a
 * surprising edit, so a removed image renders as a broken-image placeholder
 * the user can delete from the editor themselves.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing attachment id' }, { status: 400 })
  }

  const { data: row } = await supabase
    .from('note_attachments')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const { error: storageError } = await supabase.storage
    .from(NOTE_ATTACHMENT_BUCKET)
    .remove([row.storage_path as string])
  if (storageError) {
    console.error('[Notes] Failed to remove attachment object:', storageError)
  }

  const { error } = await supabase
    .from('note_attachments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Notes] Failed to delete attachment row:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
