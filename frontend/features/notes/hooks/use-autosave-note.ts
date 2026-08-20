'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createNote, deleteNote, updateNote } from '../services/notes-client'
import type { Note, NoteSource } from '../types'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveNoteOptions {
  /** An existing note to edit, or null to create a new one on first keystroke. */
  note: Note | null
  /** Only used when creating a new note. */
  source: NoteSource
  opportunityId?: string | null
  applicationId?: string | null
  /** Folder a newly created note is filed into. Ignored when editing. */
  folderId?: string | null
  /**
   * Starting title/content for a brand-new note (a template). Ignored when
   * `note` is set — an existing note's own content always wins.
   */
  draft?: { title: string; content: string }
  debounceMs?: number
  onSaved?: (note: Note) => void
  onDeleted?: () => void
}

const DEFAULT_DEBOUNCE_MS = 800

/**
 * The one autosave engine behind every note edit in the app — the Notes
 * page's inline editor and the Quick Note composer both use this, not two
 * separate implementations. Creates a draft row on the first keystroke (so
 * autosave has something to PATCH from then on), and deletes it instead of
 * saving if the user empties it back out and closes — never leaves a
 * meaningless empty record behind.
 */
export function useAutosaveNote({
  note,
  source,
  opportunityId = null,
  applicationId = null,
  folderId = null,
  draft,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onSaved,
  onDeleted,
}: UseAutosaveNoteOptions) {
  const [title, setTitle] = useState(note?.title ?? draft?.title ?? '')
  const [content, setContent] = useState(note?.content ?? draft?.content ?? '')
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  // The ref is what persist()/flush() read and write synchronously inside
  // async callbacks (never during render); noteIdState is its mirror,
  // updated in lockstep, so callers reading the hook's return value never
  // read a ref during render.
  const noteIdRef = useRef<string | null>(note?.id ?? null)
  const [noteIdState, setNoteIdState] = useState<string | null>(note?.id ?? null)
  const setNoteId = useCallback((id: string | null) => {
    noteIdRef.current = id
    setNoteIdState(id)
  }, [])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards the debounce tick against acting on stale title/content after
  // flush() already ran synchronously (e.g. a debounce tick firing a beat
  // after the composer closed).
  const isFlushedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Persists run one at a time. `noteIdRef` is written synchronously the
  // moment a draft row exists, which is enough for *sequential* saves — but
  // not for overlapping ones: a debounce tick that has already called
  // createNote is still awaiting the network when flush() runs on close, and
  // both would see a null id and create their own row. Chaining means the
  // second save starts only once the first has recorded the id, and so
  // updates that row instead of duplicating the note.
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  const runPersist = useCallback(
    async (nextTitle: string, nextContent: string) => {
      const trimmedEmpty = !nextTitle.trim() && !nextContent.trim()

      if (trimmedEmpty) {
        if (noteIdRef.current) {
          try {
            await deleteNote(noteIdRef.current)
          } catch {
            // The row will simply sit as an orphaned empty draft if this
            // fails — not worth surfacing an error for a note the user
            // already decided they didn't want.
          }
          setNoteId(null)
          onDeleted?.()
        }
        setStatus('idle')
        return
      }

      setStatus('saving')
      try {
        if (!noteIdRef.current) {
          const created = await createNote({
            title: nextTitle.trim(),
            content: nextContent,
            source,
            opportunity_id: opportunityId,
            application_id: applicationId,
            folder_id: folderId,
          })
          setNoteId(created.id)
          setStatus('saved')
          onSaved?.(created)
        } else {
          const updated = await updateNote(noteIdRef.current, {
            title: nextTitle.trim(),
            content: nextContent,
          })
          if (updated === null) {
            // Emptied via this exact update (shouldn't normally happen —
            // trimmedEmpty above already catches that case — but the API
            // is the source of truth on what "empty" means).
            setNoteId(null)
            onDeleted?.()
          } else {
            setStatus('saved')
            onSaved?.(updated)
          }
        }
      } catch {
        setStatus('error')
      }
    },
    [source, opportunityId, applicationId, folderId, onSaved, onDeleted, setNoteId]
  )

  /** Queues a save behind any still-running one, and resolves when it is done. */
  const persist = useCallback(
    (nextTitle: string, nextContent: string) => {
      const queued = queueRef.current.then(() => runPersist(nextTitle, nextContent))
      // Swallowed on the shared chain only: runPersist already reports failure
      // through `status`, and a rejection left here would break every later
      // save queued behind it.
      queueRef.current = queued.catch(() => {})
      return queued
    },
    [runPersist]
  )

  const scheduleSave = useCallback(
    (nextTitle: string, nextContent: string) => {
      isFlushedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (isFlushedRef.current) return
        persist(nextTitle, nextContent)
      }, debounceMs)
    },
    [debounceMs, persist]
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value)
      scheduleSave(value, content)
    },
    [content, scheduleSave]
  )

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value)
      scheduleSave(title, value)
    },
    [title, scheduleSave]
  )

  /** Cancels any pending debounce and saves (or deletes-if-empty) immediately. */
  const flush = useCallback(async () => {
    isFlushedRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await persist(title, content)
  }, [title, content, persist])

  return {
    title,
    content,
    setTitle: handleTitleChange,
    setContent: handleContentChange,
    status,
    flush,
    noteId: noteIdState,
  }
}
