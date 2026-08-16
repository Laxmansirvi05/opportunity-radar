'use client'

import { useCallback, useRef, useState } from 'react'
import { useRobotTaps } from './use-triple-tap'
import type { RobotPosition } from './use-robot-position'

const DRAG_THRESHOLD_PX = 6

interface UseRobotDragOptions {
  position: RobotPosition
  setPosition: (pos: RobotPosition) => void
  elementRef: React.RefObject<HTMLElement | null>
  onDoubleTap: () => void
  onTripleTap: () => void
  /** Disables new gestures while true — e.g. while the composer is open. */
  disabled?: boolean
}

interface DragState {
  pointerId: number
  startPointerX: number
  startPointerY: number
  startElementX: number
  startElementY: number
  pastThreshold: boolean
  rafId: number | null
  latest: RobotPosition
}

/**
 * Owns every pointer event on the robot — both dragging and tap-counting
 * live here together because they're the same gesture stream: a "tap" is
 * exactly a pointerdown/up pair that never crossed DRAG_THRESHOLD_PX, and a
 * completed drag's release must never also be counted as a tap. Splitting
 * these into two independent listener sets on the same element would mean
 * re-deriving that distinction twice and risking them disagreeing.
 */
export function useRobotDrag({ position, setPosition, elementRef, onDoubleTap, onTripleTap, disabled }: UseRobotDragOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const { registerTap } = useRobotTaps({ onDoubleTap, onTripleTap })

  const applyTransform = useCallback(
    (pos: RobotPosition) => {
      const el = elementRef.current
      if (el) el.style.transform = `translate(${pos.x}px, ${pos.y}px)`
    },
    [elementRef]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragRef.current = {
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startElementX: position.x,
        startElementY: position.y,
        pastThreshold: false,
        rafId: null,
        latest: position,
      }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    },
    [disabled, position]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragRef.current
      if (!state || state.pointerId !== e.pointerId) return

      const dx = e.clientX - state.startPointerX
      const dy = e.clientY - state.startPointerY

      if (!state.pastThreshold) {
        if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return
        state.pastThreshold = true
        setIsDragging(true)
      }

      state.latest = { x: state.startElementX + dx, y: state.startElementY + dy }
      if (state.rafId === null) {
        state.rafId = requestAnimationFrame(() => {
          const current = dragRef.current
          if (current) {
            applyTransform(current.latest)
            current.rafId = null
          }
        })
      }
    },
    [applyTransform]
  )

  const finishGesture = useCallback(
    (e: React.PointerEvent) => {
      const state = dragRef.current
      if (!state || state.pointerId !== e.pointerId) return
      if (state.rafId !== null) cancelAnimationFrame(state.rafId)

      if (state.pastThreshold) {
        setPosition(state.latest)
      } else {
        // A real tap: released close to where it started.
        registerTap()
      }

      dragRef.current = null
      setIsDragging(false)
    },
    [setPosition, registerTap]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => finishGesture(e), [finishGesture])

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    const state = dragRef.current
    if (!state || state.pointerId !== e.pointerId) return
    if (state.rafId !== null) cancelAnimationFrame(state.rafId)
    // A cancelled gesture (e.g. the OS took over for a system gesture)
    // reverts visually to the last committed position rather than wherever
    // the pointer happened to be — never counted as a tap either.
    applyTransform(position)
    dragRef.current = null
    setIsDragging(false)
  }, [position, applyTransform])

  return {
    isDragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
