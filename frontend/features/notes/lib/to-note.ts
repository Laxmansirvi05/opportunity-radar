import type { FolderColor, Note, SharePermission } from '../types'

export const NOTE_SELECT_COLUMNS =
  'id, user_id, title, content, source, opportunity_id, application_id, folder_id, tags, is_pinned, is_archived, deleted_at, created_at, updated_at, ' +
  'opportunities(id, title, companies(name)), note_folders(id, name, color), note_shares(slug, link_access), note_share_recipients(count)'

export type NoteRow = Omit<Note, 'opportunity' | 'folder' | 'is_shared' | 'shared_permission'> & {
  opportunities: { id: string; title: string; companies: { name: string } | null } | null
  note_folders: { id: string; name: string; color: FolderColor } | null
  note_shares: { slug: string; link_access: string } | null
  note_share_recipients: { count: number }[] | null
}

/**
 * Reshapes a joined Supabase row (NOTE_SELECT_COLUMNS) into the client-facing
 * Note shape.
 *
 * `sharedPermission` is passed in rather than read off the row because it is a
 * property of *how this caller reached the note*, not of the note itself: the
 * same row is `null` for its owner and 'view'/'edit' for a recipient.
 */
export function toNote(row: NoteRow, sharedPermission: SharePermission | null = null): Note {
  const { opportunities, note_folders, note_shares, note_share_recipients, ...rest } = row
  const recipientCount = note_share_recipients?.[0]?.count ?? 0

  return {
    ...rest,
    opportunity: opportunities
      ? { id: opportunities.id, title: opportunities.title, company_name: opportunities.companies?.name ?? null }
      : null,
    folder: note_folders
      ? { id: note_folders.id, name: note_folders.name, color: note_folders.color }
      : null,
    is_shared: note_shares?.link_access === 'view' || recipientCount > 0,
    shared_permission: sharedPermission,
  }
}
