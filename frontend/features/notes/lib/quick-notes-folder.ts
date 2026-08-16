import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The folder robot-captured notes are filed into.
 *
 * Its identity is its name rather than a dedicated column or a magic id: a
 * Quick Notes folder is an ordinary folder the student can rename, recolour,
 * move or delete like any other. If they delete it, the next quick capture
 * simply recreates it — nothing breaks and no note is orphaned.
 */
export const QUICK_NOTES_FOLDER = 'Quick Notes'

/**
 * Returns the caller's Quick Notes folder id, creating it if absent.
 *
 * Returns null rather than throwing when the folder can't be created: a quick
 * capture that cannot be filed should still be saved (unfiled) rather than
 * lost, which is the whole point of a one-keystroke capture surface.
 */
export async function resolveQuickNotesFolder(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('note_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', QUICK_NOTES_FOLDER)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from('note_folders')
    .insert({ user_id: userId, name: QUICK_NOTES_FOLDER, color: 'cyan', icon: 'bolt', position: 0 })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[Notes] Could not create the Quick Notes folder:', error)
    return null
  }
  return (created?.id as string) ?? null
}
