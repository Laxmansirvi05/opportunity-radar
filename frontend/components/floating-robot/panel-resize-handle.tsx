'use client'

interface PanelResizeHandleProps {
  isResizing: boolean
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onDoubleClick: () => void
  label: string
}

/**
 * The bottom-right corner grip both floating panels resize from.
 *
 * Double-clicking it restores the default size — the only way back once a
 * panel has been dragged to an awkward shape, short of clearing storage.
 *
 * touchAction: none so a drag on a touchscreen resizes the panel instead of
 * scrolling the page behind it.
 */
export function PanelResizeHandle({
  isResizing, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, label,
}: PanelResizeHandleProps) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={`${label} (double-click to reset)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{ touchAction: 'none' }}
      className={`absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-br-2xl grid place-items-end p-[3px] transition-colors ${
        isResizing ? 'text-primary' : 'text-on-surface-variant/50 hover:text-on-surface-variant'
      }`}
    >
      {/* Two short strokes reading as a corner grip, drawn rather than an icon
          so it sits flush in the panel's rounded corner. */}
      <svg viewBox="0 0 10 10" className="h-3 w-3" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M9 3 L3 9" />
        <path d="M9 7 L7 9" />
      </svg>
    </span>
  )
}
