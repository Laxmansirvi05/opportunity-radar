import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_LENGTH = 2000

/**
 * PATCH /api/hub/messages/[id]
 *
 * Body: { content: string }
 *
 * Edits the text of a message. RLS enforces sender_id = auth.uid(), so this
 * can never touch another user's message even if the id is guessed. A
 * message with an image may have its caption cleared to empty; a text-only
 * message may not be edited down to nothing (it would leave a message that
 * fails the table's own content-or-image check).
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
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }

  let body: { content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (content.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Message exceeds ${MAX_LENGTH} characters` }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('hub_messages')
    .select('id, sender_id, image_url')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }
  if (existing.sender_id !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
  }
  if (!content && !existing.image_url) {
    return NextResponse.json({ error: 'A text-only message cannot be edited to empty — delete it instead.' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('hub_messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', user.id)
    .select('id, content, edited_at')
    .single()

  if (updateError || !updated) {
    console.error('[Hub] Failed to edit message:', updateError)
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 })
  }

  return NextResponse.json({ message: updated })
}

/**
 * DELETE /api/hub/messages/[id]
 *
 * Deletes a Hub message. RLS enforces sender_id = auth.uid() at the database
 * level — this route simply forwards the authenticated delete.
 */
export async function DELETE(
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
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }

  // Look up the image path first (if any) so it can be cleaned up from
  // storage after the row is gone — best-effort, never blocks the delete.
  const { data: existing } = await supabase
    .from('hub_messages')
    .select('image_url')
    .eq('id', id)
    .eq('sender_id', user.id)
    .single()

  // RLS policy ensures only the sender can delete. If the user tries to delete
  // someone else's message, the delete matches zero rows and returns success
  // without exposing which user owns the message.
  const { error } = await supabase
    .from('hub_messages')
    .delete()
    .eq('id', id)
    // Belt-and-braces check — RLS already enforces this, but belt-and-braces.
    .eq('sender_id', user.id)

  if (error) {
    console.error('[Hub] Failed to delete message:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }

  if (existing?.image_url) {
    const path = extractStoragePath(existing.image_url, user.id)
    if (path) {
      const { error: storageError } = await supabase.storage.from('hub-attachments').remove([path])
      if (storageError) {
        console.error('[Hub] Failed to remove orphaned attachment:', storageError)
      }
    }
  }

  return NextResponse.json({ success: true })
}

/** Recovers the `{userId}/{filename}` storage path from a public URL. */
function extractStoragePath(publicUrl: string, userId: string): string | null {
  const marker = `/hub-attachments/${userId}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return `${userId}/${publicUrl.slice(idx + marker.length)}`
}
