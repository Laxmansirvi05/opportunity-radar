'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAutosaveNote } from '@/features/notes/hooks/use-autosave-note'
import { NoteRichEditor } from '@/features/notes/components/note-rich-editor'
import { uploadNoteAttachment } from '@/features/notes/services/notes-client'

const COMPOSER_WIDTH = 340
const COMPOSER_HEIGHT = 300
const GAP = 12
const VIEWPORT_PADDING = 12

interface QuickNoteComposerProps {
  anchor: { x: number; y: number; size: number }
  opportunityId: string | null
  applicationId: string | null
  onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
  saving: 'Saving…',
  saved: '✓ Saved',
  error: 'Unable to save',
}

function computePosition(anchor: QuickNoteComposerProps['anchor']) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Prefer opening above-left of the robot (the common bottom-right resting
  // spot), flipping to whichever side actually has room otherwise — always
  // clamped inside the viewport so it can never render off-screen.
  const preferAbove = anchor.y > COMPOSER_HEIGHT + GAP + VIEWPORT_PADDING
  const preferLeft = anchor.x > COMPOSER_WIDTH + GAP + VIEWPORT_PADDING

  let top = preferAbove ? anchor.y - COMPOSER_HEIGHT - GAP : anchor.y + anchor.size + GAP
  let left = preferLeft ? anchor.x - COMPOSER_WIDTH + anchor.size : anchor.x

  top = Math.min(Math.max(top, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, vh - COMPOSER_HEIGHT - VIEWPORT_PADDING))
  left = Math.min(Math.max(left, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, vw - COMPOSER_WIDTH - VIEWPORT_PADDING))

  return { top, left }
}

/** Keeps the composer fully on screen, whatever the drag or resize asked for. */
function clampToViewport(top: number, left: number) {
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - COMPOSER_HEIGHT - VIEWPORT_PADDING)
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - COMPOSER_WIDTH - VIEWPORT_PADDING)
  return {
    top: Math.min(Math.max(top, VIEWPORT_PADDING), maxTop),
    left: Math.min(Math.max(left, VIEWPORT_PADDING), maxLeft),
  }
}

/**
 * The Quick Note popup that expands from the robot on triple-tap. Uses the
 * same useAutosaveNote engine as the Notes page's inline editor — this is
 * not a second notes system, just a different entry point into the one API.
 */
export function QuickNoteComposer({ anchor, opportunityId, applicationId, onClose }: QuickNoteComposerProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // The robot is disabled from dragging while the composer is open, so
  // `anchor` is effectively fixed for this component's whole lifetime — a
  // lazy initializer computes the opening position once on mount without
  // needing an effect. After that the user owns it: dragging the header moves
  // the composer, and `hasMoved` stops a window resize from yanking it back to
  // the robot afterwards.
  const [style, setStyle] = useState(() => computePosition(anchor))
  const [isDragging, setIsDragging] = useState(false)
  const hasMovedRef = useRef(false)
  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; top: number; left: number } | null>(null)

  const { title, content, setTitle, setContent, status, flush, noteId } = useAutosaveNote({
    note: null,
    source: 'robot',
    opportunityId,
    applicationId,
  })

  // The note row may not exist yet when the first image is pasted — the draft
  // is only created on the first non-empty keystroke — so the upload is
  // allowed to go through unattached and is adopted once the note has an id.
  const upload = useCallback((file: File) => uploadNoteAttachment(file, noteId), [noteId])

  useEffect(() => {
    const onResize = () => {
      setStyle((prev) => {
        // Once the user has placed it themselves, a resize only clamps it back
        // inside the viewport — it never re-anchors to the robot.
        if (hasMovedRef.current) return clampToViewport(prev.top, prev.left)
        return computePosition(anchor)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startDrag = useCallback((event: React.PointerEvent) => {
    // Only a plain drag on the header chrome — never a click on the close
    // button, and never a text selection inside the editor below.
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, [contenteditable="true"]')) return

    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragOriginRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      top: style.top,
      left: style.left,
    }
    setIsDragging(true)
  }, [style.left, style.top])

  const onDragMove = useCallback((event: React.PointerEvent) => {
    const origin = dragOriginRef.current
    if (!origin) return
    hasMovedRef.current = true
    setStyle(clampToViewport(
      origin.top + (event.clientY - origin.pointerY),
      origin.left + (event.clientX - origin.pointerX)
    ))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!dragOriginRef.current) return
    ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
    dragOriginRef.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleClose = useCallback(async () => {
    await flush()
    onClose()
  }, [flush, onClose])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  return (
    <>
      <button
        type="button"
        aria-label="Close quick note"
        onClick={handleClose}
        className="fixed inset-0 z-[9998] cursor-default"
        style={{ background: 'transparent' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Quick note"
        style={{ position: 'fixed', top: style.top, left: style.left, width: COMPOSER_WIDTH }}
        className={`z-[9999] bg-surface border border-outline-variant rounded-2xl shadow-2xl p-4 flex flex-col gap-3 ${
          isDragging ? 'shadow-[0_24px_48px_rgba(0,0,0,0.35)] select-none' : ''
        }`}
      >
        <div
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ touchAction: 'none' }}
          className={`flex items-center justify-between -m-1 p-1 rounded-lg ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <h2 className="font-title-sm text-title-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">drag_indicator</span>
            Quick Note
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close quick note"
            className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {opportunityId && (
          <span className="font-label-sm text-label-sm text-primary flex items-center gap-1 -mt-1">
            <span className="material-symbols-outlined text-[14px]">work</span>
            Attached to this opportunity
          </span>
        )}

        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          aria-label="Note title"
          maxLength={200}
          className="w-full bg-transparent font-label-md text-label-md font-semibold text-on-surface placeholder:text-on-surface-variant/60 outline-none border-b border-outline-variant/50 pb-1.5"
        />
        {/* The same editor the Notes workspace uses, in its compact form —
            a quick capture should still take a checklist or a pasted
            screenshot, and a second, weaker editor here would mean notes that
            look different depending on where they were written. */}
        <NoteRichEditor
          content={content}
          onChange={setContent}
          onUpload={upload}
          placeholder="What do you want to remember?"
          compact
          minHeight={110}
        />

        <div className="flex items-center justify-end pt-1 border-t border-outline-variant/50">
          <span
            className={`font-label-sm text-label-sm ${status === 'error' ? 'text-error' : 'text-on-surface-variant'}`}
            aria-live="polite"
          >
            {STATUS_LABEL[status] ?? ''}
          </span>
        </div>
      </div>
    </>
  )
}
