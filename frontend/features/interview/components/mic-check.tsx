'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const BARS = 10
/**
 * Where the meter is drawn from in dB. -60 is near-silence on a typical laptop
 * mic and -15 is a confident speaking voice, so the 10 bars span the range a
 * student actually needs rather than the full theoretical scale (which would
 * leave normal speech sitting at two bars).
 */
const DB_FLOOR = -60
const DB_CEIL = -15
/** Bars fall slower than they rise, so a level is readable instead of flickering. */
const DECAY_PER_FRAME = 0.06

type MicState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

/**
 * A live microphone level meter, 1–10.
 *
 * Reads real audio through an AnalyserNode and drives the bars from RMS
 * converted to dB — not a random animation. The point is that a student can
 * see, before committing to a 15-minute interview, whether their mic is
 * actually picking anything up.
 *
 * The bar heights are written straight to the DOM inside the rAF loop rather
 * than through state: at 60fps a setState per frame would re-render this
 * component sixty times a second for a purely visual readout.
 */
export function MicCheck() {
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
  }, [])

  // Releasing the mic on unmount matters: without it the browser keeps showing
  // the recording indicator after the student navigates away.
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
          // Each bar fills partially, so the meter moves smoothly rather than
          // stepping between ten discrete states.
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

  const message =
    state === 'denied' ? 'Microphone blocked — allow access in your browser, then try again.'
      : state === 'unsupported' ? 'This browser cannot access a microphone.'
        : state === 'listening' ? (peak >= 4 ? 'Sounds good — the interviewer will hear you clearly.' : 'Say something — aim for 4 bars or more.')
          : 'Check your microphone before the interview starts.'

  return (
    <section className="mic-check rounded-2xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-title-sm text-title-sm text-on-surface">Microphone check</h3>
          <p className={`font-body-sm text-body-sm mt-0.5 ${state === 'denied' || state === 'unsupported' ? 'text-error' : 'text-on-surface-variant'}`}>
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={state === 'listening' ? () => { stop(); setState('idle'); setPeak(0) } : start}
          disabled={state === 'requesting' || state === 'unsupported'}
          className="mic-check-btn h-9 shrink-0 rounded-full border border-outline-variant bg-surface px-3.5 font-label-md text-label-md text-on-surface transition-all duration-300 ease-note disabled:opacity-40"
        >
          {state === 'listening' ? 'Stop' : state === 'requesting' ? 'Allowing…' : 'Test mic'}
        </button>
      </div>

      <div className="mic-meter mt-3 flex items-end gap-1.5" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={BARS} aria-valuenow={peak}>
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            ref={(el) => { barsRef.current[i] = el }}
            className="mic-bar"
            // Taller toward the right, so the meter reads as a rising scale
            // even before any sound arrives.
            style={{ height: `${18 + i * 3}px`, ['--fill' as string]: '0' }}
          >
            <span className="mic-bar-fill" />
          </span>
        ))}
        <span className="ml-2 font-label-md text-label-md tabular-nums text-on-surface-variant">
          {state === 'listening' ? `${peak}/10` : '—'}
        </span>
      </div>
    </section>
  )
}
