'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanelSize {
  width: number
  height: number
}

/**
 * The share of the viewport a floating panel may grow to occupy, per axis.
 *
 * Applied as a ceiling on growth, never as a shrink: a panel is always allowed
 * at least its own default size, because 40% of a short viewport is smaller
 * than the Quick Assistant opens at, and a panel that boots above its own
 * maximum would snap smaller the first time anyone touched the handle.
 */
export const MAX_VIEWPORT_FRACTION = 0.4

const MIN_WIDTH = 260
const MIN_HEIGHT = 220

export function maxPanelSize(defaultSize: PanelSize): PanelSize {
  return {
    width: Math.max(defaultSize.width, Math.round(window.innerWidth * MAX_VIEWPORT_FRACTION)),
    height: Math.max(defaultSize.height, Math.round(window.innerHeight * MAX_VIEWPORT_FRACTION)),
  }
}

export function clampPanelSize(size: PanelSize, defaultSize: PanelSize): PanelSize {
  const max = maxPanelSize(defaultSize)
  return {
    width: Math.min(Math.max(Math.round(size.width), MIN_WIDTH), max.width),
    height: Math.min(Math.max(Math.round(size.height), MIN_HEIGHT), max.height),
  }
}

function readStored(storageKey: string): PanelSize | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PanelSize>
    if (typeof parsed?.width !== 'number' || typeof parsed?.height !== 'number') return null
    return { width: parsed.width, height: parsed.height }
  } catch {
    // A corrupt or unreadable entry just means "use the default".
    return null
  }
}

/**
 * A user-resizable floating panel.
 *
 * Size is persisted per panel (same client-side-preference pattern as the
 * robot's own position), and re-clamped on mount and on window resize, so a
 * size saved on a large monitor doesn't reopen larger than a laptop screen.
 *
 * During a drag the element is written to directly and state is committed once
 * on release — a resize is one render and one storage write, not one per
 * pointer event.
 */
export function usePanelResize(storageKey: string, defaultSize: PanelSize) {
  // Read once, lazily, rather than in an effect. Safe from hydration mismatch
  // because both panels only mount after a real user gesture on the robot —
  // neither is ever server-rendered, so there is no server pass to disagree
  // with. Doing it in an effect instead would mean a synchronous setState on
  // mount and a visible jump from the default size to the stored one.
  const [size, setSize] = useState<PanelSize>(() => {
    if (typeof window === 'undefined') return defaultSize
    const stored = readStored(storageKey)
    return stored ? clampPanelSize(stored, defaultSize) : defaultSize
  })
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<{ pointerX: number; pointerY: number; width: number; height: number } | null>(null)

  useEffect(() => {
    const onWindowResize = () => setSize((prev) => clampPanelSize(prev, defaultSize))
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        width: size.width,
        height: size.height,
      }
      setIsResizing(true)
    },
    [size.height, size.width]
  )

  const onResizeMove = useCallback(
    (event: React.PointerEvent) => {
      const origin = originRef.current
      const panel = panelRef.current
      if (!origin || !panel) return
      const next = clampPanelSize(
        {
          width: origin.width + (event.clientX - origin.pointerX),
          height: origin.height + (event.clientY - origin.pointerY),
        },
        defaultSize
      )
      // Written straight to the DOM during the drag; committed to state on
      // release, so the resize is smooth and produces one render.
      panel.style.width = `${next.width}px`
      panel.style.height = `${next.height}px`
    },
    [defaultSize]
  )

  const endResize = useCallback(
    (event: React.PointerEvent) => {
      if (!originRef.current) return
      ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
      originRef.current = null
      setIsResizing(false)

      const panel = panelRef.current
      if (!panel) return
      const committed = clampPanelSize(
        { width: panel.getBoundingClientRect().width, height: panel.getBoundingClientRect().height },
        defaultSize
      )
      setSize(committed)
      try {
        localStorage.setItem(storageKey, JSON.stringify(committed))
      } catch {
        // Storage can be unavailable (private mode, quota); the size still
        // applies for this session.
      }
    },
    [defaultSize, storageKey]
  )

  const resetSize = useCallback(() => {
    setSize(defaultSize)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // Nothing to recover from — the in-memory reset already happened.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  return { size, isResizing, panelRef, startResize, onResizeMove, endResize, resetSize }
}
