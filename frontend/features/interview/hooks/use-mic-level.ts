'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const BARS = 10
const DB_FLOOR = -60
const DB_CEIL = -15
const DECAY_PER_FRAME = 0.06

export type MicState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

/**
 * Shared hook for microphone audio analysis. Used by both the intake page's
 * MicCheck widget and the session page's PreFlightCheck gate — previously
 * each had its own independent getUserMedia + AnalyserNode loop, meaning the
 * student's mic was requested twice (once during intake, released, then again
 * before joining). This hook centralizes that logic.
 *
 * Returns the mic state, a peak level (0–10), per-bar fill values driven by
 * a rAF loop (written to refs, not state, to avoid 60fps re-renders), and
 * start/stop controls.
 */
export function useMicLevel() {
  const [state, setState] = useState<MicState>('idle')
  const [peak, setPeak] = useState(0)

  const barsRef = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const levelRef = useRef(0)

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    barsRef.current.forEach((bar) => { if (bar) bar.style.setProperty('--fill', '0') })
    levelRef.current = 0
  }, [])

  // Release mic on unmount — without this the browser keeps showing the
  // recording indicator after the student navigates away.
  useEffect(() => stop, [stop])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      const buffer = new Float32Array(analyser.fftSize)
      setState('listening')

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
        const rms = Math.sqrt(sum / buffer.length)
        const db = 20 * Math.log10(rms || 1e-8)
        const target = Math.min(1, Math.max(0, (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)))

        // Snap up, ease down.
        levelRef.current = target > levelRef.current
          ? target
          : Math.max(target, levelRef.current - DECAY_PER_FRAME)

        const lit = levelRef.current * BARS
        barsRef.current.forEach((bar, index) => {
          if (!bar) return
          bar.style.setProperty('--fill', String(Math.min(1, Math.max(0, lit - index))))
        })

        setPeak((prev) => Math.max(prev, Math.round(levelRef.current * BARS)))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setState('denied')
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    setState('idle')
    setPeak(0)
  }, [stop])

  return { state, peak, barsRef, start, stop, reset, BARS }
}
