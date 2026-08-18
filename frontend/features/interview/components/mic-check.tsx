'use client'

import { useMicLevel } from '../hooks/use-mic-level'

/**
 * A live microphone level meter, 1–10.
 *
 * Reads real audio through an AnalyserNode and drives the bars from RMS
 * converted to dB — not a random animation. The point is that a student can
 * see, before committing to a 15-minute interview, whether their mic is
 * actually picking anything up.
 *
 * The bar heights are written straight to the DOM inside the rAF loop (via
 * useMicLevel) rather than through state: at 60fps a setState per frame would
 * re-render sixty times a second for a purely visual readout.
 */
export function MicCheck() {
  const { state, peak, barsRef, start, reset, BARS } = useMicLevel()

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
          onClick={state === 'listening' ? reset : start}
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
