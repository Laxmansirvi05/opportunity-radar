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
