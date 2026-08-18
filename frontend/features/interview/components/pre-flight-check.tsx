'use client'

import { useMicLevel } from '../hooks/use-mic-level'

/**
 * Microphone permission + level check, shown before joining the LiveKit
 * room. `getUserMedia` requires a secure context (HTTPS/localhost) and is
 * refused outright without the mic permission — see next.config.ts's
 * `Permissions-Policy: microphone=(self)`, which is the prerequisite this
 * component depends on.
 *
 * Now shares the audio analysis logic with MicCheck via useMicLevel.
 */
export function PreFlightCheck({ onReady }: { onReady: () => void }) {
  const { state, peak, barsRef, start, stop, BARS } = useMicLevel()

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
          onClick={start}
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
      <div className="w-full max-w-sm">
        <h2 className="font-bold text-on-surface mb-1">Check your microphone</h2>
        <p className="text-sm text-on-surface-variant">
          We need mic access to run the interview. Speak after granting access — the bars below should move.
        </p>
      </div>

      {state === 'listening' && (
        <div className="mic-meter flex items-end gap-1.5" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={BARS} aria-valuenow={peak}>
          {Array.from({ length: BARS }, (_, i) => (
            <span
              key={i}
              ref={(el) => { barsRef.current[i] = el }}
              className="mic-bar"
              style={{ height: `${18 + i * 3}px`, ['--fill' as string]: '0' }}
            >
              <span className="mic-bar-fill" />
            </span>
          ))}
          <span className="ml-2 font-label-md text-label-md tabular-nums text-on-surface-variant">
            {`${peak}/10`}
          </span>
        </div>
      )}

      {state === 'idle' && (
        <button
          onClick={start}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Allow microphone
        </button>
      )}
      {state === 'requesting' && (
        <span className="text-sm text-on-surface-variant">Waiting for permission…</span>
      )}
      {state === 'listening' && (
        <button
          onClick={() => {
            stop()
            onReady()
          }}
          disabled={peak < 2}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-40"
        >
          {peak >= 2 ? 'Start interview' : 'Speak louder…'}
        </button>
      )}
    </div>
  )
}
