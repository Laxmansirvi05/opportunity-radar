'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { NoteRichEditor } from './note-rich-editor'
import { useAutosaveNote } from '../hooks/use-autosave-note'
import { listNotes, uploadNoteAttachment } from '../services/notes-client'
import { toSnippet } from '../lib/note-preview'
import type { Note } from '../types'

interface OpportunityNotesProps {
  opportunityId: string
  /** The caller's tracker row for this opportunity, when one exists. */
  applicationId: string | null
}

const PREVIEW_LIMIT = 3

/**
 * The Notes section on an opportunity page.
 *
 * Reads and writes the one notes backend — no second data model, no second
 * API. A note created here is an ordinary note that happens to carry this
 * opportunity's id, so it shows up in the Notes workspace like any other and
 * links back to the listing from there.
 */
export function OpportunityNotes({ opportunityId, applicationId }: OpportunityNotesProps) {
  // Keyed by the opportunity the rows were fetched for, so a client-side
  // navigation between two listings can't show the previous one's notes.
  const [loaded, setLoaded] = useState<{ opportunityId: string; notes: Note[] } | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const now = useClientNow()

  const notes = loaded?.opportunityId === opportunityId ? loaded.notes : []
  const isLoading = loaded?.opportunityId !== opportunityId

  const refresh = useCallback(async () => {
    try {
      const all = await listNotes()
      setLoaded({ opportunityId, notes: all.filter((note) => note.opportunity_id === opportunityId) })
    } catch {
      setLoaded({ opportunityId, notes: [] })
    }
  }, [opportunityId])

  useEffect(() => {
    let cancelled = false
    listNotes()
      .then((all) => {
        if (cancelled) return
        setLoaded({ opportunityId, notes: all.filter((note) => note.opportunity_id === opportunityId) })
      })
      .catch(() => { if (!cancelled) setLoaded({ opportunityId, notes: [] }) })
    return () => { cancelled = true }
  }, [opportunityId])

  const { title, content, setTitle, setContent, status, flush } = useAutosaveNote({
    note: null,
    source: 'manual',
    opportunityId,
    applicationId,
  })

  const upload = useCallback((file: File) => uploadNoteAttachment(file), [])

  const finish = useCallback(async () => {
    await flush()
    setIsComposing(false)
    await refresh()
  }, [flush, refresh])

  return (
    <section className="flex flex-col gap-4 mt-2" aria-label="Notes on this opportunity">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-on-background">Notes</h2>
        {!isComposing && (
          <button
            type="button"
            onClick={() => setIsComposing(true)}
            className="h-9 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Note
          </button>
        )}
      </div>

      {isComposing && (
        <div className="rounded-xl border border-primary/40 bg-surface p-4 flex flex-col gap-2">
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional)"
            aria-label="Note title"
            maxLength={200}
            className="w-full bg-transparent outline-none font-title-sm text-title-sm text-on-surface placeholder:text-on-surface-variant/60"
          />
          <NoteRichEditor
            content={content}
            onChange={setContent}
            onUpload={upload}
            autoFocus={false}
            minHeight={120}
            placeholder="What do you want to remember about this opportunity?"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <span
              aria-live="polite"
              className={`font-label-sm text-label-sm ${status === 'error' ? 'text-error' : 'text-on-surface-variant'}`}
            >
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Could not save' : ''}
            </span>
            <button
              type="button"
              onClick={finish}
              className="h-9 px-4 rounded-full bg-primary text-on-primary font-label-md text-label-md cursor-pointer hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading notes…</p>
      ) : notes.length === 0 && !isComposing ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No notes on this opportunity yet. Jot down eligibility checks, questions to ask, or what to prepare.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.slice(0, PREVIEW_LIMIT).map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes?note=${note.id}`}
                className="block rounded-xl border border-outline-variant bg-surface p-3 hover:border-primary/40 transition-colors"
              >
                <p className="font-label-lg text-label-lg text-on-surface truncate">{note.title || 'Untitled'}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                  {toSnippet(note.content, 140)}
                </p>
                {now !== null && (
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                    {Math.max(0, Math.round((now - new Date(note.updated_at).getTime()) / 60000))}m ago
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <Link href="/notes" className="font-label-md text-label-md text-primary hover:underline self-start">
          View all related notes →
        </Link>
      )}
    </section>
  )
}
