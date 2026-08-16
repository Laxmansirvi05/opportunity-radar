import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFolderColor } from '@/features/notes/types'

export const runtime = 'nodejs'

const NAME_MAX = 60
const PG_UNIQUE_VIOLATION = '23505'

const FOLDER_COLUMNS = 'id, name, color, icon, parent_id, position'

/**
 * PATCH /api/notes/folders/[id]
 *
 * Partial update — rename, recolour, set an icon, or move under a different
 * parent. Body: { name?, color?, icon?, parent_id?, position? }.
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
    return NextResponse.json({ error: 'Missing folder id' }, { status: 400 })
  }

  let body: { name?: unknown; color?: unknown; icon?: unknown; parent_id?: unknown; position?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, NAME_MAX)
    if (!name) {
      return NextResponse.json({ error: 'A folder needs a name' }, { status: 400 })
    }
    patch.name = name
  }
  if (body.color !== undefined) {
    if (!isFolderColor(body.color)) {
      return NextResponse.json({ error: 'Unknown folder colour' }, { status: 400 })
    }
    patch.color = body.color
  }
  if ('icon' in body) {
    patch.icon = typeof body.icon === 'string' ? body.icon.slice(0, 40) : null
  }
  if (typeof body.position === 'number') {
    patch.position = body.position
  }
  if ('parent_id' in body) {
    if (body.parent_id === null) {
      patch.parent_id = null
    } else if (typeof body.parent_id === 'string') {
      // A folder cannot be its own parent, and the new parent must be one of
      // this user's own folders — an unvalidated id would otherwise re-parent
      // into someone else's tree.
      if (body.parent_id === id) {
        return NextResponse.json({ error: 'A folder cannot contain itself' }, { status: 400 })
      }
      if (await wouldCycle(supabase, user.id, id, body.parent_id)) {
        return NextResponse.json({ error: 'That would put the folder inside itself' }, { status: 400 })
      }
      const { data: owned } = await supabase
        .from('note_folders')
        .select('id')
        .eq('id', body.parent_id)
        .eq('user_id', user.id)
        .maybeSingle()
      patch.parent_id = owned ? body.parent_id : null
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('note_folders')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(FOLDER_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: 'A folder with that name already exists' }, { status: 409 })
    }
    console.error('[Notes] Failed to update folder:', error)
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  return NextResponse.json({ folder: data })
}

/**
 * Walks up from the proposed parent to see whether it is a descendant of the
 * folder being moved. Without this, dragging a parent into its own child
 * detaches both from the tree entirely — they still exist, but nothing
 * renders them, which reads to the user as "my folders were deleted".
 *
 * Bounded by depth rather than trusting the data to be acyclic, since a cycle
 * is exactly what this is checking for.
 */
async function wouldCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  movingId: string,
  proposedParentId: string
): Promise<boolean> {
  let cursor: string | null = proposedParentId
  for (let depth = 0; depth < 32 && cursor; depth += 1) {
    if (cursor === movingId) return true
    const { data }: { data: { parent_id: string | null } | null } = await supabase
      .from('note_folders')
      .select('parent_id')
      .eq('id', cursor)
      .eq('user_id', userId)
      .maybeSingle()
    cursor = data?.parent_id ?? null
  }
  return false
}

/**
 * DELETE /api/notes/folders/[id]
 *
 * Deletes a folder. Notes inside it are never deleted — the FK's own
 * `on delete set null` orphans them to Unfiled, so no extra app logic is
 * needed here to handle "what happens to the notes."
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
    return NextResponse.json({ error: 'Missing folder id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('note_folders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Notes] Failed to delete folder:', error)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
