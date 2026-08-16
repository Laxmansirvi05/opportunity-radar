export type NoteSource = 'manual' | 'robot'

/**
 * The folder palette. Constrained in the database too
 * (note_folders_color_valid) — a colour that exists only in TypeScript would
 * render as an unstyled folder with no clue why.
 */
export const FOLDER_COLORS = [
  'blue', 'cyan', 'purple', 'indigo', 'green', 'yellow',
  'orange', 'red', 'pink', 'teal', 'neutral',
] as const

export type FolderColor = (typeof FOLDER_COLORS)[number]

export function isFolderColor(value: unknown): value is FolderColor {
  return typeof value === 'string' && (FOLDER_COLORS as readonly string[]).includes(value)
}

/** The views the sidebar switches between. Not folders — folders are separate. */
export type NoteView = 'all' | 'recent' | 'pinned' | 'shared' | 'attachments' | 'trash' | 'archived'

export type NoteSort = 'updated' | 'created' | 'alphabetical'

export type ShareLinkAccess = 'private' | 'view'
export type SharePermission = 'view' | 'edit'

export type NoteLinkTargetType = 'note' | 'folder' | 'opportunity' | 'application'

export interface NoteOpportunityRef {
  id: string
  title: string
  company_name: string | null
}

export interface NoteFolderRef {
  id: string
  name: string
  color: FolderColor
}

export interface NoteFolder {
  id: string
  name: string
  color: FolderColor
  icon: string | null
  parent_id: string | null
  position: number
  note_count: number
  /** Up to 5 lightweight previews, for the folder card's hover fan-out. */
  previews: NotePreview[]
}

/**
 * What a folder card and a note list card render. Deliberately not the whole
 * note: rendering every full rich-text document just to draw a grid is the
 * performance mistake this type exists to prevent.
 */
export interface NotePreview {
  id: string
  title: string
  snippet: string
  image_url: string | null
  updated_at: string
  is_pinned: boolean
}

export interface NoteShareRecipient {
  id: string
  recipient_id: string
  name: string | null
  email: string | null
  avatar_url: string | null
  permission: SharePermission
}

export interface NoteShare {
  slug: string
  link_access: ShareLinkAccess
  recipients: NoteShareRecipient[]
}

export interface NoteLinkTarget {
  type: NoteLinkTargetType
  id: string
  /** Resolved at read time; null when the target no longer exists. */
  label: string | null
  sublabel: string | null
}

export interface NoteLink {
  id: string
  target: NoteLinkTarget
}

export interface NoteAttachment {
  id: string
  note_id: string | null
  note_title: string | null
  url: string
  storage_path: string
  name: string
  mime_type: string
  size_bytes: number
  kind: 'image' | 'file'
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  source: NoteSource
  opportunity_id: string | null
  application_id: string | null
  folder_id: string | null
  tags: string[]
  is_pinned: boolean
  is_archived: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  /** Joined for display — the opportunity a note is attached to, if any. */
  opportunity: NoteOpportunityRef | null
  /** Joined for display — the folder a note belongs to, if any (null = Unfiled). */
  folder: NoteFolderRef | null
  /** True when this note has a live share (link or recipients). */
  is_shared: boolean
  /**
   * Set only when the note reached this client through a share rather than
   * ownership, so the editor knows to go read-only. Null for your own notes.
   */
  shared_permission: SharePermission | null
}

export interface CreateNoteInput {
  title?: string
  content?: string
  source: NoteSource
  opportunity_id?: string | null
  application_id?: string | null
  folder_id?: string | null
  tags?: string[]
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  tags?: string[]
  is_pinned?: boolean
  is_archived?: boolean
  folder_id?: string | null
  /** Restore from Trash. Only ever set to null — nothing sends a timestamp. */
  deleted_at?: null
}

export interface CreateFolderInput {
  name: string
  color?: FolderColor
  icon?: string | null
  parent_id?: string | null
}

export interface UpdateFolderInput {
  name?: string
  color?: FolderColor
  icon?: string | null
  parent_id?: string | null
  position?: number
}

export type BulkNoteAction = 'move' | 'pin' | 'unpin' | 'archive' | 'unarchive' | 'trash' | 'restore' | 'delete'
