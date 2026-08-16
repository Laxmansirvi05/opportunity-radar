'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { addLink, searchLinkTargets } from '../services/notes-client'
import type { NoteLink, NoteLinkTarget } from '../types'

interface LinkPickerProps {
  noteId: string
  onClose: () => void
  onLinked: (links: NoteLink[]) => void
}

const ICONS: Record<string, string> = {
  note: 'description',
  folder: 'folder',
  opportunity: 'work',
  application: 'assignment_turned_in',
}

const GROUP_LABELS: Record<string, string> = {
  note: 'Notes',
  folder: 'Folders',
  opportunity: 'Opportunities',
  application: 'Applications',
}

const SEARCH_DEBOUNCE_MS = 250

/**
 * Picks something for this note to reference — another note, a folder, an
 * opportunity, or a tracked application.
 *
 * The reference stores an id, never a copy: the linked note stays the single
 * source of truth, so editing it updates every note pointing at it.
 */
export function LinkPicker({ noteId, onClose, onLinked }: LinkPickerProps) {
  const [query, setQuery] = useState('')
  const [targets, setTargets] = useState<NoteLinkTarget[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    // Every state update happens inside the timer callback rather than in the
    // effect body: a synchronous setState here would cascade an extra render
    // on each keystroke, and the debounce means the user never sees the
    // difference.
    timerRef.current = setTimeout(() => {
      if (trimmed.length < 2) {
        setTargets([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      searchLinkTargets(trimmed, noteId)
        .then(setTargets)
        .catch(() => setTargets([]))
        .finally(() => setIsSearching(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [noteId, query])

  const grouped = targets.reduce<Record<string, NoteLinkTarget[]>>((acc, target) => {
    ;(acc[target.type] ??= []).push(target)
    return acc
  }, {})

  return (
    <div role="dialog" aria-modal="true" aria-label="Link something to this note" className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] p-4 bg-scrim/50 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-low border border-outline-variant shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes, folders, opportunities…"
            aria-label="Search for something to link"
            className="flex-1 bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
          />
          <button type="button" aria-label="Close" onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {query.trim().length < 2 && (
            <p className="px-4 py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              Type at least two characters to search.
            </p>
          )}
          {query.trim().length >= 2 && isSearching && (
            <p className="px-4 py-6 text-center font-body-sm text-body-sm text-on-surface-variant">Searching…</p>
          )}
          {query.trim().length >= 2 && !isSearching && targets.length === 0 && (
            <p className="px-4 py-6 text-center font-body-sm text-body-sm text-on-surface-variant">Nothing matched that search.</p>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="px-4 pt-2 pb-1 font-label-sm text-label-sm text-on-surface-variant">{GROUP_LABELS[type]}</p>
              {items.map((target) => (
                <button
                  key={`${target.type}:${target.id}`}
                  type="button"
                  onClick={async () => {
                    try {
                      onLinked(await addLink(noteId, target.type, target.id))
                      toast.success('Link added')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Could not add the link.')
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left cursor-pointer hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">{ICONS[target.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-label-md text-label-md text-on-surface truncate">{target.label}</span>
                    {target.sublabel && (
                      <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">{target.sublabel}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
