import type {
  BulkNoteAction,
  CreateFolderInput,
  CreateNoteInput,
  Note,
  NoteAttachment,
  NoteFolder,
  NoteLink,
  NoteLinkTarget,
  NoteLinkTargetType,
  NoteShare,
  NoteSort,
  NoteView,
  ShareLinkAccess,
  SharePermission,
  UpdateFolderInput,
  UpdateNoteInput,
} from '../types'

export interface ListNotesOptions {
  q?: string
  view?: NoteView
  sort?: NoteSort
  /** A folder's id, or 'unfiled' for notes with no folder. Omit for every folder. */
  folderId?: string
  tag?: string
  attachmentsOnly?: boolean
}

export interface UploadedAttachment {
  url: string
  id: string | null
  name: string
  mime_type: string
  size_bytes: number
  kind: 'image' | 'file'
}

interface NotesApiResponse {
  error?: string
  note?: Note
  notes?: Note[]
  folder?: NoteFolder
  folders?: NoteFolder[]
  share?: NoteShare | null
  links?: NoteLink[]
  targets?: NoteLinkTarget[]
  attachments?: NoteAttachment[]
  url?: string
  deleted?: boolean
  success?: boolean
  count?: number
}

async function parseJsonOrThrow(res: Response): Promise<NotesApiResponse> {
  let body: NotesApiResponse | null = null
  try {
    body = (await res.json()) as NotesApiResponse
  } catch {
    // fall through to the generic error below
  }
  if (!res.ok) {
    throw new Error(body?.error || 'Request failed')
  }
  return body ?? {}
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/**
 * The single client-side entry point for every note write, whether it comes
 * from the Notes workspace, the Quick Note composer, or an opportunity page —
 * there is one notes API, and this is its one client.
 */
export async function listNotes(options: ListNotesOptions = {}): Promise<Note[]> {
  const params = new URLSearchParams()
  if (options.q) params.set('q', options.q)
  if (options.view) params.set('view', options.view)
  if (options.sort) params.set('sort', options.sort)
  if (options.folderId) params.set('folder_id', options.folderId)
  if (options.tag) params.set('tag', options.tag)
  if (options.attachmentsOnly) params.set('attachments', 'true')

  const res = await fetch(`/api/notes?${params.toString()}`)
  const body = await parseJsonOrThrow(res)
  return body.notes ?? []
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const res = await fetch('/api/notes', jsonRequest('POST', input))
  const body = await parseJsonOrThrow(res)
  if (!body.note) throw new Error('Note was not created')
  return body.note
}

/**
 * Returns null when the update emptied the note and the server deleted it —
 * the Quick Note composer's "draft became empty again" path. Callers treat a
 * null the same way they treat a delete, rather than as a failure.
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note | null> {
  const res = await fetch(`/api/notes/${id}`, jsonRequest('PATCH', input))
  const body = await parseJsonOrThrow(res)
  if (body.deleted) return null
  if (!body.note) throw new Error('Note was not saved')
  return body.note
}

/** Soft-deletes into Trash. Pass permanent for the irreversible one. */
export async function deleteNote(id: string, permanent = false): Promise<void> {
  const res = await fetch(`/api/notes/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' })
  await parseJsonOrThrow(res)
}

export async function restoreNote(id: string): Promise<Note | null> {
  return updateNote(id, { deleted_at: null })
}

export async function duplicateNote(id: string): Promise<Note> {
  const res = await fetch(`/api/notes/${id}/duplicate`, { method: 'POST' })
  const body = await parseJsonOrThrow(res)
  if (!body.note) throw new Error('Note was not duplicated')
  return body.note
}

export async function bulkNoteAction(
  ids: string[],
  action: BulkNoteAction,
  folderId?: string | null
): Promise<number> {
  const res = await fetch('/api/notes/bulk', jsonRequest('POST', { ids, action, folder_id: folderId ?? null }))
  const body = await parseJsonOrThrow(res)
  return body.count ?? 0
}

export async function emptyTrash(): Promise<number> {
  const res = await fetch('/api/notes/bulk', jsonRequest('POST', { action: 'empty_trash' }))
  const body = await parseJsonOrThrow(res)
  return body.count ?? 0
}

// ── Folders ──────────────────────────────────────────────────────────────────

export async function listFolders(): Promise<NoteFolder[]> {
  const res = await fetch('/api/notes/folders')
  const body = await parseJsonOrThrow(res)
  return body.folders ?? []
}

export async function createFolder(input: CreateFolderInput): Promise<NoteFolder> {
  const res = await fetch('/api/notes/folders', jsonRequest('POST', input))
  const body = await parseJsonOrThrow(res)
  if (!body.folder) throw new Error('Folder was not created')
  return body.folder
}

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<NoteFolder> {
  const res = await fetch(`/api/notes/folders/${id}`, jsonRequest('PATCH', input))
  const body = await parseJsonOrThrow(res)
  if (!body.folder) throw new Error('Folder was not updated')
  return body.folder
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/notes/folders/${id}`, { method: 'DELETE' })
  await parseJsonOrThrow(res)
}

export async function reorderFolders(
  order: { id: string; position: number; parent_id?: string | null }[]
): Promise<void> {
  const res = await fetch('/api/notes/folders', jsonRequest('PATCH', { order }))
  await parseJsonOrThrow(res)
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export async function getShare(noteId: string): Promise<NoteShare | null> {
  const res = await fetch(`/api/notes/${noteId}/share`)
  const body = await parseJsonOrThrow(res)
  return body.share ?? null
}

export async function setLinkAccess(noteId: string, linkAccess: ShareLinkAccess): Promise<NoteShare | null> {
  const res = await fetch(`/api/notes/${noteId}/share`, jsonRequest('PUT', { link_access: linkAccess }))
  const body = await parseJsonOrThrow(res)
  return body.share ?? null
}

export async function addShareRecipient(
  noteId: string,
  email: string,
  permission: SharePermission
): Promise<NoteShare | null> {
  const res = await fetch(`/api/notes/${noteId}/share`, jsonRequest('POST', { email, permission }))
  const body = await parseJsonOrThrow(res)
  return body.share ?? null
}

export async function removeShareRecipient(noteId: string, recipientId: string): Promise<NoteShare | null> {
  const res = await fetch(`/api/notes/${noteId}/share?recipient_id=${encodeURIComponent(recipientId)}`, {
    method: 'DELETE',
  })
  const body = await parseJsonOrThrow(res)
  return body.share ?? null
}

export async function stopSharing(noteId: string): Promise<NoteShare | null> {
  const res = await fetch(`/api/notes/${noteId}/share`, { method: 'DELETE' })
  const body = await parseJsonOrThrow(res)
  return body.share ?? null
}

// ── Internal links ───────────────────────────────────────────────────────────

export async function listLinks(noteId: string): Promise<NoteLink[]> {
  const res = await fetch(`/api/notes/${noteId}/links`)
  const body = await parseJsonOrThrow(res)
  return body.links ?? []
}

export async function addLink(
  noteId: string,
  targetType: NoteLinkTargetType,
  targetId: string
): Promise<NoteLink[]> {
  const res = await fetch(`/api/notes/${noteId}/links`, jsonRequest('POST', { target_type: targetType, target_id: targetId }))
  const body = await parseJsonOrThrow(res)
  return body.links ?? []
}

export async function removeLink(noteId: string, linkId: string): Promise<NoteLink[]> {
  const res = await fetch(`/api/notes/${noteId}/links?link_id=${encodeURIComponent(linkId)}`, { method: 'DELETE' })
  const body = await parseJsonOrThrow(res)
  return body.links ?? []
}

export async function searchLinkTargets(q: string, excludeNoteId?: string): Promise<NoteLinkTarget[]> {
  const params = new URLSearchParams({ q })
  if (excludeNoteId) params.set('exclude', excludeNoteId)
  const res = await fetch(`/api/notes/link-targets?${params.toString()}`)
  const body = await parseJsonOrThrow(res)
  return body.targets ?? []
}

// ── Attachments ──────────────────────────────────────────────────────────────

export async function listAttachments(kind?: 'image' | 'file'): Promise<NoteAttachment[]> {
  const res = await fetch(`/api/notes/attachments${kind ? `?kind=${kind}` : ''}`)
  const body = await parseJsonOrThrow(res)
  return body.attachments ?? []
}

export async function deleteAttachment(id: string): Promise<void> {
  const res = await fetch(`/api/notes/attachments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  await parseJsonOrThrow(res)
}

/**
 * Uploads an image or file for a note.
 *
 * noteId is optional: the editor can legitimately upload before the note row
 * exists (a screenshot pasted into a brand-new note), and the attachment is
 * associated once the note has an id.
 */
export async function uploadNoteAttachment(file: File, noteId?: string | null): Promise<UploadedAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  if (noteId) formData.append('note_id', noteId)

  const res = await fetch('/api/notes/upload', { method: 'POST', body: formData })
  const body = (await res.json().catch(() => null)) as (UploadedAttachment & { error?: string }) | null

  if (!res.ok || !body?.url) {
    throw new Error(body?.error || 'Upload failed')
  }
  return body
}

/** Back-compat alias — the editor only ever needs the resulting URL. */
export async function uploadNoteImage(file: File, noteId?: string | null): Promise<string> {
  const uploaded = await uploadNoteAttachment(file, noteId)
  return uploaded.url
}
