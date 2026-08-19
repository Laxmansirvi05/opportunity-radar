'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  BarVisualizer,
  useConnectionState,
  useLocalParticipant,
  useTranscriptions,
  useChat,
  DisconnectButton,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import '@livekit/components-styles'
import { getPersona } from '../lib/personas'

/**
 * The live interview room. Audio-only WebRTC straight to LiveKit — never
 * through our own backend, which is what avoids Vercel's serverless
 * duration ceiling entirely (see docs/AI-FEATURES-HANDOFF.md §3.2).
 *
 * `<StartAudio>` is required for iOS Safari's autoplay policy — without it
 * the interviewer's voice never plays until some other interaction unlocks
 * the AudioContext.
 *
 * The transcript panel and text-fallback input are built on LiveKit's
 * standard transcription/chat primitives — useChat's `send()` goes out on
 * LiveKit's standard text-chat channel, the conventional mechanism a voice
 * agent listens on for a typed fallback.
 *
 * Presentation is a bespoke "premium" interview stage: an audio-reactive
 * voice orb, a glass transcript rail, and a calm live status bar. All the
 * LiveKit hooks below are unchanged from the working wiring — only the
 * markup is styled.
 */
export function LiveRoom({
  token,
  serverUrl,
  personaId,
  onEnded,
}: {
  token: string
  serverUrl: string
  personaId: string | null
  onEnded: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const handleDisconnected = useCallback(() => {
    onEnded()
  }, [onEnded])

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      audio
      video={false}
      connect
      onDisconnected={handleDisconnected}
      onError={(e) => setError(e.message)}
      className="w-full"
    >
      <RoomAudioRenderer />
      <StartAudioOverlay />
      {error && (
        <div className="mb-3 w-full rounded-2xl border border-error/40 bg-error-container/80 backdrop-blur px-4 py-3 text-sm text-on-error-container flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={handleDisconnected}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-semibold cursor-pointer"
          >
            End interview
          </button>
        </div>
      )}
      <RoomStage personaId={personaId} />
    </LiveKitRoom>
  )
}

/**
 * iOS/Safari autoplay unlock, restyled as a soft prompt instead of the
 * library's default button. StartAudio hides itself once audio is allowed.
 */
function StartAudioOverlay() {
  return (
    <StartAudio
      label="Tap to enable interview audio"
      className="lk-start-audio-premium"
    />
  )
}

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    startedAt.current = Date.now()
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [active])

  return seconds
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

type VoiceState = 'connecting' | 'speaking' | 'listening' | 'thinking' | 'idle'

function RoomStage({ personaId }: { personaId: string | null }) {
  const { state, audioTrack } = useVoiceAssistant()
  const connectionState = useConnectionState()
  const { localParticipant } = useLocalParticipant()
  const transcriptions = useTranscriptions()
  const { send, isSending } = useChat()
  const [draft, setDraft] = useState('')
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const persona = useMemo(() => getPersona(personaId), [personaId])
  const connected = connectionState === ConnectionState.Connected
  const elapsed = useElapsedSeconds(connected)

  const voiceState: VoiceState = !connected
    ? 'connecting'
    : state === 'speaking'
      ? 'speaking'
      : state === 'listening'
        ? 'listening'
        : state === 'thinking'
          ? 'thinking'
          : 'idle'

  const stateLabel =
    voiceState === 'connecting'
      ? 'Connecting your interviewer…'
      : voiceState === 'speaking'
        ? `${persona.name} is speaking`
        : voiceState === 'listening'
          ? 'Listening — go ahead'
          : voiceState === 'thinking'
            ? 'Thinking…'
            : 'Ready when you are'

  useEffect(() => {
    // Scroll the transcript's own container (not scrollIntoView, which would
    // drag the whole page). Depends on the array reference: LiveKit updates an
    // existing segment (partial → final) without changing the count.
    const el = transcriptScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [transcriptions])

  async function sendDraft() {
    const text = draft.trim()
    if (!text || isSending) return
    setDraft('')
    try {
      await send(text)
    } catch {
      // Best-effort — the mic path is primary; a failed text send just means
      // the candidate can retry or speak instead.
    }
  }

  return (
    <div className="interview-stage relative w-full overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest">
      <StageStyles />

      {/* Ambient premium backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={`orb-ambient orb-ambient--${voiceState} bg-gradient-to-br ${persona.gradient}`} />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_40%,var(--color-surface-container-lowest)_100%)]" />
      </div>

      <div className="relative flex flex-col lg:flex-row gap-4 p-4 md:p-5 lg:h-[calc(100vh-8.5rem)]">
        {/* ── Stage ─────────────────────────────────────────────── */}
        <section className="relative flex-1 flex flex-col rounded-2xl min-h-[26rem]">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-surface/70 backdrop-blur px-3 py-1.5 border border-outline-variant/50">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/80">
                Opportunity Radar
              </span>
              {connected && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-error">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-error" />
                  </span>
                  Live
                </span>
              )}
            </div>
            {connected && (
              <span className="flex items-center gap-1.5 rounded-full bg-surface/70 backdrop-blur px-3 py-1.5 border border-outline-variant/50 font-mono text-sm tabular-nums text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">timer</span>
                {formatClock(elapsed)}
              </span>
            )}
          </div>

          {/* Orb */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
            <div className="relative flex items-center justify-center">
              {/* Pulsing rings */}
              <span aria-hidden className={`orb-ring orb-ring--1 orb-ring--${voiceState}`} />
              <span aria-hidden className={`orb-ring orb-ring--2 orb-ring--${voiceState}`} />
              <span aria-hidden className={`orb-ring orb-ring--3 orb-ring--${voiceState}`} />

              {/* Core */}
              <div className={`orb-core orb-core--${voiceState} bg-gradient-to-br ${persona.gradient}`}>
                <div className="orb-core-sheen" />
                {audioTrack ? (
                  <BarVisualizer
                    state={state}
                    barCount={5}
                    trackRef={audioTrack}
                    className="orb-visualizer"
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-surface text-[52px] opacity-90">
                    {persona.icon}
                  </span>
                )}
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-on-background">{persona.name}</h2>
              <p className="mt-1 text-sm text-on-surface-variant max-w-xs mx-auto">{persona.style}</p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-surface/60 backdrop-blur px-4 py-2 border border-outline-variant/50">
              <StateDot voiceState={voiceState} />
              <span className="text-sm font-semibold text-on-surface">{stateLabel}</span>
            </div>
          </div>

          {/* End button */}
          <div className="flex justify-center pb-1">
            <DisconnectButton className="group inline-flex items-center gap-2 rounded-full bg-error px-6 py-3 text-sm font-bold text-on-error shadow-lg shadow-error/25 transition-all duration-300 hover:shadow-error/40 hover:brightness-105 active:scale-[0.98] cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">call_end</span>
              End interview
            </DisconnectButton>
          </div>
        </section>

        {/* ── Transcript rail ───────────────────────────────────── */}
        <aside className="flex flex-col rounded-2xl border border-outline-variant/60 bg-surface/70 backdrop-blur-xl overflow-hidden h-[55vh] lg:h-auto lg:w-[400px] lg:shrink-0 shadow-xl shadow-black/5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/50 shrink-0">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
              Live transcript
            </span>
            {connected && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Streaming
              </span>
            )}
          </div>

          <div
            ref={transcriptScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-3"
          >
            {transcriptions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">forum</span>
                <p className="text-xs text-on-surface-variant/70 max-w-[16rem]">
                  Your conversation appears here as you speak. Say hello to begin.
                </p>
              </div>
            ) : (
              transcriptions.map((t, i) => {
                const isMe = t.participantInfo.identity === localParticipant.identity
                const key = `${t.participantInfo.identity}-${t.streamInfo?.id ?? i}`
                return (
                  <div key={key} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                      {isMe ? 'You' : persona.name}
                    </span>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-primary text-on-primary rounded-br-md'
                          : 'bg-surface-container text-on-surface rounded-bl-md border border-outline-variant/40'
                      }`}
                    >
                      {t.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="p-3 border-t border-outline-variant/50 shrink-0 flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendDraft() }}
              placeholder="Type an answer if audio isn't working…"
              aria-label="Type an answer"
              className="flex-1 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-2.5 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
            />
            <button
              onClick={sendDraft}
              disabled={!draft.trim() || isSending}
              aria-label="Send"
              className="grid place-items-center h-10 w-10 rounded-xl bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 active:scale-95 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StateDot({ voiceState }: { voiceState: VoiceState }) {
  const cls =
    voiceState === 'speaking'
      ? 'bg-primary'
      : voiceState === 'listening'
        ? 'bg-emerald-500'
        : voiceState === 'thinking'
          ? 'bg-amber-500'
          : 'bg-on-surface-variant/50'
  return (
    <span className="relative flex h-2 w-2">
      {voiceState !== 'idle' && voiceState !== 'connecting' && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${cls}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${cls}`} />
    </span>
  )
}

/**
 * Scoped keyframes + orb treatment. Kept inline so the premium look ships
 * with the component and doesn't leak globally; class names are namespaced.
 */
function StageStyles() {
  return (
    <style>{`
      .interview-stage { isolation: isolate; }

      .orb-ambient {
        position: absolute;
        left: 50%; top: 34%;
        width: 46rem; height: 46rem;
        transform: translate(-50%, -50%);
        border-radius: 9999px;
        filter: blur(70px);
        opacity: 0.5;
        transition: opacity 600ms ease, transform 600ms ease;
      }
      .orb-ambient--speaking { opacity: 0.8; }
      .orb-ambient--listening { opacity: 0.5; }
      .orb-ambient--thinking { opacity: 0.62; }
      .orb-ambient--connecting { opacity: 0.35; }

      .orb-core {
        position: relative;
        display: grid; place-items: center;
        width: 12.5rem; height: 12.5rem;
        border-radius: 9999px;
        border: 1px solid color-mix(in srgb, var(--color-outline-variant) 60%, transparent);
        box-shadow:
          0 10px 40px -8px rgba(0,0,0,0.28),
          inset 0 1px 12px rgba(255,255,255,0.25);
        transition: transform 300ms ease, box-shadow 400ms ease;
        overflow: hidden;
      }
      @media (min-width: 768px) { .orb-core { width: 14rem; height: 14rem; } }
      .orb-core-sheen {
        position: absolute; inset: 0;
        background: radial-gradient(70% 55% at 50% 22%, rgba(255,255,255,0.5), transparent 60%);
        pointer-events: none;
      }
      .orb-core--speaking { animation: orbBreatheFast 1.6s ease-in-out infinite; }
      .orb-core--listening { animation: orbBreathe 3.4s ease-in-out infinite; }
      .orb-core--thinking { animation: orbBreathe 2.2s ease-in-out infinite; }
      .orb-core--connecting { opacity: 0.75; animation: orbBreathe 2.6s ease-in-out infinite; }

      .orb-visualizer {
        width: 62%; height: 46%;
        --lk-fg: var(--color-on-surface);
      }
      .orb-visualizer > * {
        background: var(--color-on-surface) !important;
        opacity: 0.85; border-radius: 9999px;
      }

      .orb-ring {
        position: absolute;
        border-radius: 9999px;
        border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
        opacity: 0;
      }
      .orb-ring--1 { width: 13.5rem; height: 13.5rem; }
      .orb-ring--2 { width: 16.5rem; height: 16.5rem; }
      .orb-ring--3 { width: 19.5rem; height: 19.5rem; }
      @media (min-width: 768px) {
        .orb-ring--1 { width: 15rem; height: 15rem; }
        .orb-ring--2 { width: 18.5rem; height: 18.5rem; }
        .orb-ring--3 { width: 22rem; height: 22rem; }
      }
      .orb-ring--speaking { animation: ringPulse 1.8s ease-out infinite; }
      .orb-ring--2.orb-ring--speaking { animation-delay: 0.35s; }
      .orb-ring--3.orb-ring--speaking { animation-delay: 0.7s; }
      .orb-ring--listening { animation: ringBreathe 3.6s ease-in-out infinite; opacity: 0.25; }
      .orb-ring--thinking { animation: ringBreathe 2s ease-in-out infinite; opacity: 0.2; }

      @keyframes orbBreathe {
        0%,100% { transform: scale(1); }
        50% { transform: scale(1.035); }
      }
      @keyframes orbBreatheFast {
        0%,100% { transform: scale(1); box-shadow: 0 10px 40px -8px rgba(0,0,0,0.28), inset 0 1px 12px rgba(255,255,255,0.25); }
        50% { transform: scale(1.06); box-shadow: 0 18px 60px -6px color-mix(in srgb, var(--color-primary) 45%, transparent), inset 0 1px 16px rgba(255,255,255,0.35); }
      }
      @keyframes ringPulse {
        0% { transform: scale(0.85); opacity: 0.5; }
        100% { transform: scale(1.15); opacity: 0; }
      }
      @keyframes ringBreathe {
        0%,100% { transform: scale(0.98); }
        50% { transform: scale(1.04); }
      }

      .lk-start-audio-premium {
        margin: 0 auto 0.75rem; display: block;
        border-radius: 9999px;
        background: var(--color-primary); color: var(--color-on-primary);
        padding: 0.6rem 1.25rem; font-size: 0.8rem; font-weight: 700;
        border: none; cursor: pointer;
      }

      @media (prefers-reduced-motion: reduce) {
        .orb-core, .orb-ring, .orb-ambient { animation: none !important; }
      }
    `}</style>
  )
}
