'use client'

import { useCallback, useRef, useState } from 'react'
import type { NoteFolder } from '../types'
import { paletteFor } from '../lib/folder-colors'

interface FolderCard3DProps {
  folder: NoteFolder
  onOpen: (folder: NoteFolder) => void
  onContextMenu: (folder: NoteFolder, position: { x: number; y: number }) => void
}

/**
 * How far each hovered preview card fans out. Index 0 sits centre-back, and
 * the rest alternate left/right so the stack opens like a hand of cards
 * rather than drifting in one direction.
 */
const FAN = [
  { x: 0, y: -74, rotate: 0, delay: 0 },
  { x: -76, y: -60, rotate: -11, delay: 40 },
  { x: 76, y: -60, rotate: 11, delay: 40 },
  { x: -138, y: -34, rotate: -19, delay: 80 },
  { x: 138, y: -34, rotate: 19, delay: 80 },
]

/**
 * A folder rendered with real depth: a back panel, the notes sitting inside
 * it, and a front panel that tilts open on hover.
 *
 * Built from CSS perspective and transforms rather than a 3D renderer —
 * every folder on screen would otherwise cost a WebGL context, and this is a
 * browsing grid that needs to stay responsive at a hundred folders. Only
 * transform, opacity and box-shadow animate, so nothing here triggers layout.
 */
export function FolderCard3D({ folder, onOpen, onContextMenu }: FolderCard3DProps) {
  const palette = paletteFor(folder.color)
  const [isHovered, setIsHovered] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previews = folder.previews.slice(0, FAN.length)

  const open = useCallback(() => {
    if (isOpening) return
    setIsOpening(true)
    // Let the open animation play before the view swaps, so the folder is
    // seen opening rather than the grid simply blinking out.
    openTimer.current = setTimeout(() => onOpen(folder), 220)
  }, [folder, isOpening, onOpen])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        const rect = (event.target as HTMLElement).getBoundingClientRect()
        onContextMenu(folder, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }
    },
    [folder, onContextMenu, open]
  )

  const lifted = isHovered || isOpening

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${folder.name}, ${folder.note_count} ${folder.note_count === 1 ? 'note' : 'notes'}`}
      onClick={open}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(folder, { x: event.clientX, y: event.clientY })
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="group relative flex flex-col items-center gap-3 p-3 rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform duration-500 ease-note"
      style={{ perspective: '1000px', transform: isOpening ? 'scale(1.06)' : undefined }}
    >
      <div
        // A fixed 75px stage, capped at the cell so it can never overflow on a
        // narrow column. Sized inside the cell rather than by changing the
        // grid, so columns, gaps and label alignment stay exactly where they
        // were.
        className="relative aspect-square transition-transform duration-500 ease-note"
        style={{
          width: 'min(75px, 100%)',
          transformStyle: 'preserve-3d',
          transform: lifted ? 'translateY(-10px) rotateX(-8deg)' : 'rotateX(0deg)',
          filter: lifted ? `drop-shadow(0 18px 28px ${palette.glow})` : 'drop-shadow(0 6px 12px rgba(0,0,0,0.18))',
        }}
      >
        {/* Back panel, with the tab reading as part of the same sheet. */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-xl"
          style={{ height: '82%', backgroundColor: palette.back }}
        />
        <div
          className="absolute left-[8%] rounded-t-lg"
          style={{ bottom: '80%', width: '42%', height: '9%', backgroundColor: palette.tab }}
        />

        {/* The notes inside. Hidden behind the front panel at rest, fanned
            out above it on hover — the whole point of the interaction. */}
        {previews.map((preview, index) => {
          const fan = FAN[index]
          return (
            <div
              key={preview.id}
              aria-hidden="true"
              className="absolute left-1/2 bottom-[12%] w-[62%] rounded-lg overflow-hidden bg-surface border border-outline-variant shadow-lg transition-all duration-500 ease-note"
              style={{
                height: '52%',
                transform: lifted
                  ? `translateX(calc(-50% + ${fan.x}px)) translateY(${fan.y}px) rotate(${fan.rotate}deg) scale(1)`
                  : 'translateX(-50%) translateY(6px) rotate(0deg) scale(0.9)',
                opacity: lifted ? 1 : 0,
                transitionDelay: `${lifted ? fan.delay : 0}ms`,
                zIndex: 5 - index,
              }}
            >
              {preview.image_url ? (
                <div className="flex h-full">
                  <div
                    className="w-1/3 bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${preview.image_url})` }}
                  />
                  <div className="p-1.5 min-w-0">
                    <p className="font-label-sm text-label-sm text-on-surface truncate">{preview.title || 'Untitled'}</p>
                    <p className="font-body-sm text-[10px] leading-tight text-on-surface-variant line-clamp-3">{preview.snippet}</p>
                  </div>
                </div>
              ) : (
                <div className="p-1.5">
                  <p className="font-label-sm text-label-sm text-on-surface truncate">{preview.title || 'Untitled'}</p>
                  <p className="font-body-sm text-[10px] leading-tight text-on-surface-variant line-clamp-4">{preview.snippet}</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Front panel. Hinged at its bottom edge so it opens like a real
            folder flap instead of sliding down the card. */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-xl transition-transform duration-500 ease-note"
          style={{
            height: '71%',
            transformOrigin: 'bottom center',
            transform: lifted ? 'rotateX(-32deg)' : 'rotateX(0deg)',
            background: `linear-gradient(160deg, ${palette.frontFrom} 0%, ${palette.frontTo} 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          <span
            className="material-symbols-outlined absolute left-[8%] bottom-[8%] text-[20px] opacity-70"
            style={{ color: palette.ink }}
          >
            {folder.icon || 'folder'}
          </span>
          <span
            className="absolute right-[8%] bottom-[8%] font-label-sm text-label-sm tabular-nums opacity-80"
            style={{ color: palette.ink }}
          >
            {folder.note_count}
          </span>
        </div>
      </div>

      <div className="text-center min-w-0 w-full">
        <p className="font-label-lg text-label-lg text-on-surface truncate">{folder.name}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {folder.note_count} {folder.note_count === 1 ? 'note' : 'notes'}
        </p>
      </div>
    </div>
  )
}
