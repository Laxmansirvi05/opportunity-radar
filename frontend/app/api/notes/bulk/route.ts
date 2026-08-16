import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BulkNoteAction } from '@/features/notes/types'
import { deleteNoteAttachments } from '@/features/notes/lib/delete-note-attachments'

export const runtime = 'nodejs'

const MAX_IDS = 200

const ACTIONS: BulkNoteAction[] = ['move', 'pin', 'unpin', 'archive', 'unarchive', 'trash', 'restore', 'delete']

/**
 * POST /api/notes/bulk
 *
 * One request for an action applied to a multi-selection. Body:
 * { ids: string[], action, folder_id? } — or { action: 'empty_trash' },
 * which needs no ids.
 *
 * Every statement carries .eq('user_id', ...) so a forged id in the payload
 * simply matches nothing, rather than reaching another user's note. That is
 * also why this is one UPDATE with .in(...) rather than a loop: a single
 * ownership-filtered statement cannot partially escape its own filter.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ids?: unknown; action?: unknown; folder_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.action === 'empty_trash') {
    return emptyTrash(supabase, user.id)
  }

  const action = body.action as BulkNoteAction
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS)
    : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No notes selected' }, { status: 400 })
  }

  if (action === 'delete') {
    // Attachments first: once the rows are gone their storage paths are gone
    // with them, and the objects would be orphaned in the bucket forever.
    await Promise.all(ids.map((id) => deleteNoteAttachments(supabase, user.id, id)))
    const { error } = await supabase.from('notes').delete().eq('user_id', user.id).in('id', ids)
    if (error) {
      console.error('[Notes] Bulk permanent delete failed:', error)
      return NextResponse.json({ error: 'Failed to delete notes' }, { status: 500 })
    }
    return NextResponse.json({ success: true, count: ids.length })
  }

  const patch: Record<string, unknown> = {}
  switch (action) {
    case 'move': {
      let folderId = typeof body.folder_id === 'string' ? body.folder_id : null
      if (folderId) {
        const { data: owned } = await supabase
          .from('note_folders')
          .select('id')
          .eq('id', folderId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!owned) folderId = null
      }
      patch.folder_id = folderId
      break
    }
    case 'pin':       patch.is_pinned = true; break
    case 'unpin':     patch.is_pinned = false; break
    case 'archive':   patch.is_archived = true; break
    case 'unarchive': patch.is_archived = false; break
    case 'trash':     patch.deleted_at = new Date().toISOString(); break
    case 'restore':   patch.deleted_at = null; break
  }

  const { error } = await supabase
    .from('notes')
    .update(patch)
    .eq('user_id', user.id)
    .in('id', ids)

  if (error) {
    console.error(`[Notes] Bulk ${action} failed:`, error)
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: ids.length })
}

async function emptyTrash(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: trashed, error: listError } = await supabase
    .from('notes')
    .select('id')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)

  if (listError) {
    console.error('[Notes] Failed to read trash:', listError)
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 })
  }

  const ids = (trashed ?? []).map((row) => row.id as string)
  if (ids.length === 0) {
    return NextResponse.json({ success: true, count: 0 })
  }

  await Promise.all(ids.map((id) => deleteNoteAttachments(supabase, userId, id)))

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)

  if (error) {
    console.error('[Notes] Failed to empty trash:', error)
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: ids.length })
}
