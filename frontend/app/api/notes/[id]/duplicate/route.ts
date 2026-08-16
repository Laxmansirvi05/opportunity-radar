import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTE_SELECT_COLUMNS, toNote, type NoteRow } from '@/features/notes/lib/to-note'

export const runtime = 'nodejs'

const TITLE_MAX = 200

/**
 * POST /api/notes/[id]/duplicate
 *
 * Copies a note into a new row in the same folder. Content, tags, folder and
 * opportunity/application context all carry over; pinned, archived, shares
 * and internal links deliberately do not — a copy is a fresh draft, not a
 * second copy of someone's sharing decisions.
 *
 * Attachments are referenced, not re-uploaded: both notes point at the same
 * storage objects. That is why the duplicate's attachment rows are inserted
 * too — otherwise deleting the original would clean up storage out from under
 * the copy.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }

  const { data: source, error: fetchError } = await supabase
    .from('notes')
    .select('title, content, tags, folder_id, opportunity_id, application_id, source')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const baseTitle = (source.title as string) || 'Untitled'
  const title = `${baseTitle} copy`.slice(0, TITLE_MAX)

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title,
      content: source.content,
      tags: source.tags,
      folder_id: source.folder_id,
      opportunity_id: source.opportunity_id,
      application_id: source.application_id,
      source: source.source,
    })
    .select(NOTE_SELECT_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[Notes] Failed to duplicate note:', error)
    return NextResponse.json({ error: 'Failed to duplicate note' }, { status: 500 })
  }

  const copy = toNote(data as unknown as NoteRow)

  const { data: attachments } = await supabase
    .from('note_attachments')
    .select('storage_path, url, name, mime_type, size_bytes, kind')
    .eq('user_id', user.id)
    .eq('note_id', id)

  if (attachments && attachments.length > 0) {
    const { error: attachError } = await supabase.from('note_attachments').insert(
      attachments.map((row) => ({ ...row, user_id: user.id, note_id: copy.id }))
    )
    if (attachError) {
      // The copy itself is fine — only its attachment bookkeeping failed, so
      // the Attachments view may under-report. Not worth failing the whole
      // duplicate over, but not worth swallowing silently either.
      console.error('[Notes] Failed to copy attachment rows:', attachError)
    }
  }

  return NextResponse.json({ note: copy })
}
