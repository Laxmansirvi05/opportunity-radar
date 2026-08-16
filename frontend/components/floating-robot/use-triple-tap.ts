'use client'

import { useCallback, useEffect, useRef } from 'react'

const TAP_WINDOW_MS = 600
const REQUIRED_TAPS = 3

/**
 * Pure tap-counting logic, kept separate from any DOM/pointer wiring so it's
 * directly unit-testable. registerTap() records one tap and returns true
 * exactly when the Nth tap (REQUIRED_TAPS) lands within TAP_WINDOW_MS of the
 * first tap in the current run — a tap arriving after the window resets the
 * count to 1 (this tap starts a new run) rather than to 0.
 */
export function createTapCounter(now: () => number = Date.now) {
  let timestamps: number[] = []

  function registerTap(): boolean {
    const t = now()
    timestamps = timestamps.filter((ts) => t - ts <= TAP_WINDOW_MS)
    timestamps.push(t)
    if (timestamps.length >= REQUIRED_TAPS) {
      timestamps = []
      return true
    }
    return false
  }

  function reset() {
    timestamps = []
  }

  return { registerTap, reset }
}

/** React-hook wrapper around createTapCounter for use inside a component. */
export function useTripleTap(onTripleTap: () => void) {
  const counterRef = useRef(createTapCounter())
  // A ref, not a dependency — keeps registerTap's identity stable across
  // renders (it's attached to a live DOM pointer listener) without risking
  // a stale closure if the caller passes a fresh callback each render.
  const callbackRef = useRef(onTripleTap)
  useEffect(() => {
    callbackRef.current = onTripleTap
  }, [onTripleTap])

  const registerTap = useCallback(() => {
    if (counterRef.current.registerTap()) {
      callbackRef.current()
    }
  }, [])

  return { registerTap }
}

const SETTLE_MS = 260

interface MultiTapHandlers {
  onDoubleTap: () => void
  onTripleTap: () => void
}

interface MultiTapDeps {
  now?: () => number
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

/**
 * Distinguishes a double tap from a triple tap.
 *
 * The second tap cannot fire immediately, or every triple tap would open the
 * Quick Assistant on its way to opening the Quick Note. So the double-tap
 * action waits SETTLE_MS for a possible third tap and is cancelled if one
 * arrives — the standard cost of overloading one gesture, and the reason the
 * delay is short enough not to feel laggy.
 *
 * Timers are injected rather than captured so this stays directly testable
 * without real clocks.
 */
export function createMultiTapDetector(
  { onDoubleTap, onTripleTap }: MultiTapHandlers,
  { now = Date.now, schedule = setTimeout, cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }: MultiTapDeps = {}
) {
  let timestamps: number[] = []
  let pending: unknown = null

  function clearPending() {
    if (pending !== null) {
      cancel(pending)
      pending = null
    }
  }

  function reset() {
    clearPending()
    timestamps = []
  }

  function registerTap() {
    const t = now()
    timestamps = timestamps.filter((ts) => t - ts <= TAP_WINDOW_MS)
    timestamps.push(t)

    if (timestamps.length >= REQUIRED_TAPS) {
      // A third tap beats the pending double — cancel it before it fires.
      clearPending()
      timestamps = []
      onTripleTap()
      return
    }

    if (timestamps.length === 2) {
      clearPending()
      pending = schedule(() => {
        pending = null
        timestamps = []
        onDoubleTap()
      }, SETTLE_MS)
    }
  }

  return { registerTap, reset }
}

/** React-hook wrapper around createMultiTapDetector. */
export function useRobotTaps(handlers: MultiTapHandlers) {
  // Refs, not dependencies — registerTap is attached to a live DOM pointer
  // listener, so its identity must stay stable while still calling the
  // latest callbacks.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const detectorRef = useRef<ReturnType<typeof createMultiTapDetector> | null>(null)

  // Built on first use inside the event handler rather than during render:
  // the detector owns a timer, so it must be created once, and creating it in
  // the render body would mean touching a ref during render.
  const getDetector = useCallback(() => {
    if (detectorRef.current == null) {
      detectorRef.current = createMultiTapDetector({
        onDoubleTap: () => handlersRef.current.onDoubleTap(),
        onTripleTap: () => handlersRef.current.onTripleTap(),
      })
    }
    return detectorRef.current
  }, [])

  // A pending double-tap timer must not outlive the component.
  useEffect(() => () => detectorRef.current?.reset(), [])

  const registerTap = useCallback(() => getDetector().registerTap(), [getDetector])

  return { registerTap }
}
