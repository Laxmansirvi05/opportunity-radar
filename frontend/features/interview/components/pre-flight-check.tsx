'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Microphone permission + level check, shown before joining the LiveKit
 * room. `getUserMedia` requires a secure context (HTTPS/localhost) and is
 * refused outright without the mic permission — see next.config.ts's
 * `Permissions-Policy: microphone=(self)`, which is the prerequisite this
 * component depends on.
 */
export function PreFlightCheck({ onReady }: { onReady: () => void }) {
  const [state, setState] = useState<'idle' | 'requesting' | 'denied' | 'unsupported' | 'ready'>('idle')
  const [level, setLevel] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function requestMic() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setState('ready')

      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioContextCtor()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setLevel(Math.min(1, avg / 80))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      setState('denied')
    }
  }

  if (state === 'unsupported') {
    return (
      <div className="bg-error-container text-on-error-container rounded-xl p-6 text-sm">
        <p className="font-semibold mb-1">Your browser doesn&apos;t support live audio</p>
        <p>Voice interviews need microphone access via a modern browser (Chrome, Edge, or Safari on iOS/macOS). Please switch browsers to continue.</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="bg-error-container text-on-error-container rounded-xl p-6 text-sm">
        <p className="font-semibold mb-1">Microphone access denied</p>
        <p className="mb-3">The interviewer needs to hear you to run a voice interview. Allow microphone access in your browser&apos;s site settings, then try again.</p>
        <button
          onClick={requestMic}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-6 flex flex-col items-center text-center gap-4">
      <span className="material-symbols-outlined text-primary text-[40px]">mic</span>
      <div>
        <h2 className="font-bold text-on-surface mb-1">Check your microphone</h2>
        <p className="text-sm text-on-surface-variant max-w-sm">
          We need mic access to run the interview. Speak after granting access — the bar below should move.
        </p>
      </div>

      {state === 'ready' && (
        <div className="w-full max-w-xs h-2 rounded-full bg-surface-container overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      )}

      {state === 'idle' && (
        <button
          onClick={requestMic}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Allow microphone
        </button>
      )}
      {state === 'requesting' && (
        <span className="text-sm text-on-surface-variant">Waiting for permission…</span>
      )}
      {state === 'ready' && (
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop())
            onReady()
          }}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Start interview
        </button>
      )}
    </div>
  )
}
