'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { NoteRichEditor } from './note-rich-editor'
import { ShareDialog } from './share-dialog'
import { LinkPicker } from './link-picker'
import { useAutosaveNote } from '../hooks/use-autosave-note'
import { listLinks, removeLink, uploadNoteAttachment } from '../services/notes-client'
import type { Note, NoteLink } from '../types'

interface NoteEditorPaneProps {
  note: Note | null
  /** Starting content for a new note created from a template. */
  draft?: { title: string; content: string }
  folderId: string | null
  opportunityId?: string | null
  applicationId?: string | null
  onClose: () => void
  onSaved: (note: Note) => void
  onDeleted: (id: string) => void
  onAction: (action: 'pin' | 'archive' | 'duplicate' | 'trash' | 'move', note: Note) => void
}

const TARGET_ICONS: Record<string, string> = {
  note: 'description',
  folder: 'folder',
  opportunity: 'work',
  application: 'assignment_turned_in',
}

const TARGET_HREFS: Record<string, (id: string) => string> = {
  note: (id) => `/notes?note=${id}`,
  folder: (id) => `/notes?folder=${id}`,
  opportunity: (id) => `/opportunities/${id}`,
  application: () => '/tracker',
}

/**
 * The writing surface: a sticky header, the document, and its references.
 *
 * Autosave is the only save path — there is no Save button, and pending
 * changes are flushed before the pane closes so navigating away can't lose
 * the last few keystrokes.
 */
export function NoteEditorPane({
  note, draft, folderId, opportunityId, applicationId, onClose, onSaved, onDeleted, onAction,
}: NoteEditorPaneProps) {
  // Keyed by note id rather than cleared on switch: rendering is gated on the
  // key matching, so a stale note's links can never appear against a new note
  // while its own fetch is still in flight.
  const [linkState, setLinkState] = useState<{ noteId: string | null; links: NoteLink[] }>({ noteId: null, links: [] })
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isLinkPickerOpen, setIsLinkPickerOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const readOnly = note?.shared_permission === 'view'

  const { title, content, setTitle, setContent, status, flush, noteId } = useAutosaveNote({
    note,
    source: 'manual',
    opportunityId: opportunityId ?? note?.opportunity_id ?? null,
    applicationId: applicationId ?? note?.application_id ?? null,
    folderId,
    draft,
    onSaved,
    onDeleted: () => { if (note) onDeleted(note.id) },
  })

  useEffect(() => {
    if (!noteId) return
    let cancelled = false
    listLinks(noteId)
      .then((result) => { if (!cancelled) setLinkState({ noteId, links: result }) })
      .catch(() => { /* the Related list simply stays empty */ })
    return () => { cancelled = true }
  }, [noteId])

  const links = linkState.noteId === noteId ? linkState.links : []

  useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [isMenuOpen])

  const close = useCallback(async () => {
    await flush()
    onClose()
  }, [flush, onClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isShareOpen && !isLinkPickerOpen) {
        void close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, isShareOpen, isLinkPickerOpen])

  const upload = useCallback((file: File) => uploadNoteAttachment(file, noteId), [noteId])

  const statusLabel =
    status === 'saving' ? 'Saving…'
      : status === 'saved' ? 'Saved'
        : status === 'error' ? 'Could not save' : ''

  return (
    <section className="flex flex-col h-full min-h-0 bg-surface" aria-label="Note editor">
      <header className="flex items-center gap-2 px-3 sm:px-5 py-2.5 border-b border-outline-variant shrink-0">
        <button
          type="button"
          onClick={close}
          aria-label="Back to notes"
          className="h-9 w-9 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <span
          aria-live="polite"
          className={`font-label-sm text-label-sm shrink-0 ${status === 'error' ? 'text-error' : 'text-on-surface-variant'}`}
        >
          {statusLabel}
        </span>

        {readOnly && (
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container shrink-0">
            View only
          </span>
        )}

        <div className="flex-1" />

        {note && !readOnly && (
          <>
            <button
              type="button"
              onClick={() => setIsLinkPickerOpen(true)}
              className="h-9 px-3 rounded-full flex items-center gap-1.5 text-on-surface-variant hover:bg-surface-container cursor-pointer font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[18px]">add_link</span>
              <span className="hidden sm:inline">Link</span>
            </button>
            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="h-9 px-3 rounded-full flex items-center gap-1.5 text-on-surface-variant hover:bg-surface-container cursor-pointer font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              <span className="hidden sm:inline">Share</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="More actions"
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="h-9 w-9 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>

              {isMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl py-1">
                  {([
                    { action: 'pin', icon: 'push_pin', label: note.is_pinned ? 'Unpin' : 'Pin' },
                    { action: 'archive', icon: 'archive', label: note.is_archived ? 'Unarchive' : 'Archive' },
                    { action: 'duplicate', icon: 'content_copy', label: 'Duplicate' },
                    { action: 'move', icon: 'drive_file_move', label: 'Move to folder' },
                  ] as const).map((item) => (
                    <button
                      key={item.action}
                      type="button"
                      role="menuitem"
                      onClick={() => { setIsMenuOpen(false); onAction(item.action, note) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer text-on-surface hover:bg-surface-container font-label-md text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div className="h-px bg-outline-variant my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setIsMenuOpen(false); onAction('trash', note) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer text-error hover:bg-error-container font-label-md text-label-md"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Move to Trash
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            aria-label="Note title"
            readOnly={readOnly}
            className="w-full bg-transparent border-none outline-none font-headline-sm text-headline-sm text-on-surface placeholder:text-on-surface-variant/60 mb-2"
          />

          {note?.opportunity && (
            <a
              href={`/opportunities/${note.opportunity.id}`}
              className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-[16px]">work</span>
              {note.opportunity.title}
              {note.opportunity.company_name && <span className="opacity-70">· {note.opportunity.company_name}</span>}
            </a>
          )}

          <NoteRichEditor
            content={content}
            onChange={setContent}
            onUpload={upload}
            editable={!readOnly}
            autoFocus={!note}
            minHeight={320}
            placeholder="Start writing…"
          />

          {links.length > 0 && (
            <section className="mt-8 pt-4 border-t border-outline-variant" aria-label="Related">
              <h2 className="font-label-lg text-label-lg text-on-surface-variant mb-2">Related</h2>
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 group">
                    {link.target.label ? (
                      <a
                        href={TARGET_HREFS[link.target.type](link.target.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-1.5 rounded-xl hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                          {TARGET_ICONS[link.target.type]}
                        </span>
                        <span className="font-label-md text-label-md text-on-surface truncate">{link.target.label}</span>
                        {link.target.sublabel && (
                          <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{link.target.sublabel}</span>
                        )}
                      </a>
                    ) : (
                      <span className="flex-1 px-2.5 py-1.5 font-body-sm text-body-sm text-on-surface-variant italic">
                        This {link.target.type} is no longer available
                      </span>
                    )}
                    {!readOnly && noteId && (
                      <button
                        type="button"
                        aria-label="Remove link"
                        onClick={async () => {
                          try {
                            setLinkState({ noteId, links: await removeLink(noteId, link.id) })
                          } catch {
                            toast.error('Could not remove the link.')
                          }
                        }}
                        className="h-7 w-7 grid place-items-center rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-container cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {isShareOpen && note && (
        <ShareDialog
          noteId={note.id}
          noteTitle={title}
          onClose={() => setIsShareOpen(false)}
          onChanged={() => { /* the card's shared badge refreshes on the next list load */ }}
        />
      )}

      {isLinkPickerOpen && noteId && (
        <LinkPicker
          noteId={noteId}
          onClose={() => setIsLinkPickerOpen(false)}
          onLinked={(next) => { setLinkState({ noteId, links: next }); setIsLinkPickerOpen(false) }}
        />
      )}
    </section>
  )
}
