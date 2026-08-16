import type { SupabaseClient } from '@supabase/supabase-js'

export const NOTE_ATTACHMENT_BUCKET = 'note-attachments'

/**
 * Removes a note's uploaded files from storage, then their rows.
 *
 * Called only on paths that destroy a note for real (permanent delete, empty
 * trash, an emptied draft) — never on a soft delete, since a note sitting in
 * Trash must still render its images if it gets restored.
 *
 * Storage failures are logged but not fatal: an orphaned object costs a
 * little storage, whereas refusing the delete would leave the user unable to
 * remove their own note. The row deletion is what the caller actually needs
 * to succeed.
 */
export async function deleteNoteAttachments(
  supabase: SupabaseClient,
  userId: string,
  noteId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('note_attachments')
    .select('id, storage_path')
    .eq('user_id', userId)
    .eq('note_id', noteId)

  if (error) {
    console.error('[Notes] Failed to read attachments before delete:', error)
    return
  }
  // Defensive: this runs on the delete path, where a surprising response
  // shape must not turn "remove my note" into a crash. An unexpected shape
  // simply means no storage cleanup, and the row deletion below still runs.
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return

  const paths = rows.map((row) => row.storage_path as string).filter(Boolean)
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(NOTE_ATTACHMENT_BUCKET).remove(paths)
    if (storageError) {
      console.error('[Notes] Failed to remove attachment objects:', storageError)
    }
  }

  // The rows would cascade with the note anyway; deleting them explicitly
  // keeps this correct for the emptied-draft path too, where the note row is
  // removed by a different query than the one that owns this cleanup.
  const { error: rowError } = await supabase
    .from('note_attachments')
    .delete()
    .eq('user_id', userId)
    .eq('note_id', noteId)

  if (rowError) {
    console.error('[Notes] Failed to delete attachment rows:', rowError)
  }
}
