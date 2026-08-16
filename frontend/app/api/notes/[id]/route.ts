import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTE_SELECT_COLUMNS, toNote, type NoteRow } from '@/features/notes/lib/to-note'
import { sanitizeNoteContent } from '@/features/notes/lib/sanitize-note-content'
import { deleteNoteAttachments } from '@/features/notes/lib/delete-note-attachments'

export const runtime = 'nodejs'

const TITLE_MAX = 200
const CONTENT_MAX = 200000

/**
 * PATCH /api/notes/[id]
 *
 * Partial update — title/content/tags for an edit, is_pinned/is_archived for
 * a toggle, folder_id for a move, or deleted_at: null to restore from Trash.
 * Same shape used by autosave and by the Quick Note composer's flush-on-close,
 * so there's exactly one write path for every kind of note update.
 *
 * A recipient holding 'edit' on a shared note may change title and content
 * only. Pinning, filing, archiving and trashing are the owner's organisation
 * of their own workspace, not content, so they stay owner-only even for an
 * editor — and the database agrees: notes_update_shared_with_me grants the
 * write, while every organisational query here still filters on user_id.
 *
 * If title and content both end up empty after this update, the row is
 * deleted outright rather than saved or trashed — this is the Quick Note
 * composer's "draft became empty again" path, and an empty row is meaningless
 * rather than something a user would want to recover from Trash.
 */
export async function PATCH(
  req: NextRequest,
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

  let body: {
    title?: unknown
    content?: unknown
    tags?: unknown
    is_pinned?: unknown
    is_archived?: unknown
    folder_id?: unknown
    deleted_at?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: owned } = await supabase
    .from('notes')
    .select('id, title, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  let existing = owned
  let isOwner = Boolean(owned)

  if (!existing) {
    const { data: share } = await supabase
      .from('note_share_recipients')
      .select('permission')
      .eq('note_id', id)
      .eq('recipient_id', user.id)
      .maybeSingle()

    if (share?.permission === 'edit') {
      const { data: sharedNote } = await supabase
        .from('notes')
        .select('id, title, content')
        .eq('id', id)
        .maybeSingle()
      existing = sharedNote
      isOwner = false
    }
  }

  if (!existing) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.title === 'string') patch.title = body.title.slice(0, TITLE_MAX)
  if (typeof body.content === 'string') patch.content = sanitizeNoteContent(body.content.slice(0, CONTENT_MAX))

  if (isOwner) {
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.filter((t): t is string => typeof t === 'string').slice(0, 20)
    }
    if (typeof body.is_pinned === 'boolean') patch.is_pinned = body.is_pinned
    if (typeof body.is_archived === 'boolean') patch.is_archived = body.is_archived
    // Only ever null — restore from Trash. A client cannot set a delete
    // timestamp through here; trashing goes through DELETE.
    if (body.deleted_at === null) patch.deleted_at = null
    // 'folder_id' in body (rather than a typeof check) so an explicit null —
    // "move this note back to Unfiled" — is distinguishable from the field
    // being omitted entirely ("don't touch its folder").
    if ('folder_id' in body) {
      if (body.folder_id === null) {
        patch.folder_id = null
      } else if (typeof body.folder_id === 'string') {
        const { data: ownedFolder } = await supabase
          .from('note_folders')
          .select('id')
          .eq('id', body.folder_id)
          .eq('user_id', user.id)
          .maybeSingle()
        patch.folder_id = ownedFolder ? body.folder_id : null
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const nextTitle = typeof patch.title === 'string' ? patch.title : existing.title
  const nextContent = typeof patch.content === 'string' ? patch.content : existing.content
  const touchesText = 'title' in patch || 'content' in patch

  if (touchesText && !nextTitle.trim() && !stripsToText(nextContent)) {
    // Only the owner can empty a note out of existence; a shared editor
    // clearing the text should not silently destroy someone else's note.
    if (!isOwner) {
      return NextResponse.json({ error: 'A shared note cannot be emptied' }, { status: 403 })
    }
    await deleteNoteAttachments(supabase, user.id, id)
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (deleteError) {
      console.error('[Notes] Failed to delete emptied note:', deleteError)
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }
    return NextResponse.json({ deleted: true })
  }

  let update = supabase.from('notes').update(patch).eq('id', id)
  if (isOwner) update = update.eq('user_id', user.id)

  const { data, error } = await update.select(NOTE_SELECT_COLUMNS).single()

  if (error || !data) {
    console.error('[Notes] Failed to update note:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ note: toNote(data as unknown as NoteRow, isOwner ? null : 'edit') })
}

/**
 * True when the document still carries something a reader would see.
 *
 * A tiptap document is never literally '' — an emptied editor still
 * serialises to '<p></p>'. Trimming the string alone would therefore never
 * detect "the user cleared this", which is exactly the condition the empty-
 * draft cleanup depends on.
 */
function stripsToText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
    || /<img\b/i.test(html)
}

/**
 * DELETE /api/notes/[id]
 *
 * Soft-deletes into Trash by default. `?permanent=true` destroys the row and
 * its uploaded attachments for real — that is the only path that cannot be
 * undone, and it is never the default, so a mis-click costs a restore rather
 * than the note.
 */
export async function DELETE(
  req: NextRequest,
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

  const permanent = new URL(req.url).searchParams.get('permanent') === 'true'

  if (permanent) {
    await deleteNoteAttachments(supabase, user.id, id)
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Notes] Failed to permanently delete note:', error)
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
    }
    return NextResponse.json({ success: true, permanent: true })
  }

  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Notes] Failed to trash note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  return NextResponse.json({ success: true, permanent: false })
}
