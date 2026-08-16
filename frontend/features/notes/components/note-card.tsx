'use client'

import { useCallback, useRef } from 'react'
import type { Note } from '../types'
import { checklistProgress, firstImageUrl, hasAttachmentMarkup, toSnippet } from '../lib/note-preview'
import { paletteFor } from '../lib/folder-colors'

interface NoteCardProps {
  note: Note
  layout: 'grid' | 'list'
  selected: boolean
  selectionMode: boolean
  onOpen: (note: Note) => void
  onToggleSelect: (note: Note, additive: boolean) => void
  onContextMenu: (note: Note, position: { x: number; y: number }) => void
  /** Hydration-safe clock from useClientNow — null until after mount. */
  now: number | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Formatted by hand rather than with toLocaleDateString.
 *
 * This string is rendered during SSR and again on hydration, and the two
 * runtimes resolve the locale differently — Node produced "16 Aug" while the
 * browser produced "Aug 16", a live-reproduced React hydration error. Building
 * it from a fixed month table makes both renders identical by construction.
 *
 * UTC for the same reason: getMonth()/getDate() read the local zone, so a
 * server in UTC and a browser in IST disagree about the date for five and a
 * half hours of every day.
 */
function absoluteDate(iso: string): string {
  const date = new Date(iso)
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

function relativeTime(iso: string, now: number | null): string {
  // Before hydration there is no clock, so the card shows the note's date —
  // a value the server and the client compute identically.
  if (now === null) return absoluteDate(iso)
  const diff = now - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return absoluteDate(iso)
}

/**
 * A note as it appears in a list or grid.
 *
 * Everything shown is derived from a truncated snapshot of the document, not
 * a render of it — drawing a grid of fifty notes must not mean mounting fifty
 * rich-text documents.
 *
 * `now` is passed in by the list rather than read here, so every card in a
 * render agrees on the time and none of them reads the clock during render
 * (the hydration-mismatch class of bug this codebase has hit before).
 */
export function NoteCard({
  note, layout, selected, selectionMode, onOpen, onToggleSelect, onContextMenu,
  now,
}: NoteCardProps) {
  const snippet = toSnippet(note.content, layout === 'grid' ? 180 : 120)
  const image = firstImageUrl(note.content)
  const checklist = checklistProgress(note.content)
  const hasAttachment = hasAttachmentMarkup(note.content)
  const folderPalette = note.folder ? paletteFor(note.folder.color) : null

  // Long-press is the selection gesture on touch, where there is no right
  // click and no modifier key. Cancelled by any movement so a scroll that
  // starts on a card doesn't select it.
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current)
    longPressRef.current = null
  }, [])

  const startLongPress = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') return
      didLongPressRef.current = false
      longPressRef.current = setTimeout(() => {
        didLongPressRef.current = true
        onToggleSelect(note, true)
      }, 500)
    },
    [note, onToggleSelect]
  )

  const handleClick = (event: React.MouseEvent) => {
    // The long press already acted; the click that follows it must not also
    // open the note.
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }
    if (selectionMode || event.metaKey || event.ctrlKey) {
      onToggleSelect(note, event.metaKey || event.ctrlKey)
      return
    }
    onOpen(note)
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={note.title || 'Untitled note'}
      aria-pressed={selected}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); onOpen(note) }
        if (event.key === ' ') { event.preventDefault(); onToggleSelect(note, true) }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(note, { x: event.clientX, y: event.clientY })
      }}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerMove={cancelLongPress}
      onPointerCancel={cancelLongPress}
      className={`group relative text-left rounded-2xl border bg-surface-container-low p-3.5 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant'
      } ${layout === 'list' ? 'flex items-start gap-3' : 'flex flex-col gap-2'}`}
    >
      {image && (
        <div
          className={`rounded-xl bg-cover bg-center shrink-0 ${layout === 'grid' ? 'w-full h-28' : 'w-16 h-16'}`}
          style={{ backgroundImage: `url(${image})` }}
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <h3 className="font-title-sm text-title-sm text-on-surface truncate flex-1">
            {note.title || 'Untitled'}
          </h3>
          {note.is_pinned && (
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0" title="Pinned">push_pin</span>
          )}
          {note.is_shared && (
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0" title="Shared">group</span>
          )}
        </div>

        {snippet && (
          <p className={`font-body-sm text-body-sm text-on-surface-variant mt-1 ${layout === 'grid' ? 'line-clamp-3' : 'line-clamp-2'}`}>
            {snippet}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="font-label-sm text-label-sm text-on-surface-variant">{relativeTime(note.updated_at, now)}</span>

          {note.folder && folderPalette && (
            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: folderPalette.tab }} aria-hidden="true" />
              {note.folder.name}
            </span>
          )}

          {checklist && (
            <span className="inline-flex items-center gap-0.5 font-label-sm text-label-sm text-on-surface-variant" title="Checklist progress">
              <span className="material-symbols-outlined text-[14px]">checklist</span>
              {checklist.done}/{checklist.total}
            </span>
          )}

          {hasAttachment && (
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant" title="Has an attachment">attach_file</span>
          )}

          {note.opportunity && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary-container text-on-secondary-container font-label-sm text-label-sm max-w-full truncate">
              <span className="material-symbols-outlined text-[13px]">work</span>
              <span className="truncate">{note.opportunity.title}</span>
            </span>
          )}

          {note.source === 'robot' && (
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant" title="Captured with the robot">smart_toy</span>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label={selected ? 'Deselect note' : 'Select note'}
        onClick={(event) => { event.stopPropagation(); onToggleSelect(note, true) }}
        className={`absolute top-2 right-2 h-6 w-6 grid place-items-center rounded-full border transition-opacity cursor-pointer ${
          selected
            ? 'bg-primary border-primary text-on-primary opacity-100'
            : 'bg-surface border-outline-variant text-on-surface-variant opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">check</span>
      </button>
    </article>
  )
}
