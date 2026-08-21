'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  useConnectionState,
  useLocalParticipant,
  useTranscriptions,
  useChat,
  DisconnectButton,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import '@livekit/components-styles'
import { getPersona } from '../lib/personas'
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura'

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
 * Layout is a three-band call screen: a status header, a two-pane body
 * (interviewer / transcript), and a control bar. All the LiveKit hooks below
 * are unchanged from the working wiring — only the markup is styled.
 */
export function LiveRoom({
  token,
  serverUrl,
  personaId,
  roleTitle,
  company,
  onEnded,
}: {
  token: string
  serverUrl: string
  personaId: string | null
  roleTitle?: string | null
  company?: string | null
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
      className="flex h-full w-full flex-col"
    >
      <RoomAudioRenderer />
      <StartAudioOverlay />
      {error && (
        <div className="mb-3 w-full shrink-0 rounded-2xl border border-error/40 bg-error-container/80 backdrop-blur px-4 py-3 text-sm text-on-error-container flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={handleDisconnected}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-semibold cursor-pointer"
          >
            End interview
          </button>
        </div>
      )}
      <RoomStage personaId={personaId} roleTitle={roleTitle} company={company} />
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

/** Copy and colour for the chip on the interviewer card. */
const STATE_CHIP: Record<VoiceState, { label: string; className: string }> = {
  connecting: { label: 'Connecting', className: 'bg-surface-container text-on-surface-variant' },
  speaking: { label: 'Speaking', className: 'bg-primary-container/25 text-primary' },
  listening: { label: 'Listening', className: 'bg-tertiary-container/40 text-on-tertiary-container' },
  thinking: { label: 'Thinking', className: 'bg-secondary-container/40 text-on-secondary-container' },
  idle: { label: 'Idle', className: 'bg-surface-container text-on-surface-variant' },
}

function RoomStage({
  personaId,
  roleTitle,
  company,
}: {
  personaId: string | null
  roleTitle?: string | null
  company?: string | null
}) {
  const { state, audioTrack } = useVoiceAssistant()
  const connectionState = useConnectionState()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const transcriptions = useTranscriptions()
  const { send, isSending } = useChat()
  const [draft, setDraft] = useState('')
  const transcriptScrollRef = useRef<HTMLDivElement>(null)

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

  const statusLine =
    voiceState === 'connecting'
      ? 'Connecting your interviewer…'
      : voiceState === 'speaking'
        ? `${persona.name} is speaking`
        : voiceState === 'listening'
          ? 'Listening — go ahead'
          : voiceState === 'thinking'
            ? 'Thinking…'
            : 'Ready when you are'

  // The role line under the title, when we know it.
  const subtitle = [roleTitle, company].filter(Boolean).join(' · ')

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

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      // Nothing useful to do: the browser refused the device change, and the
      // button's state comes from LiveKit, so it stays truthful either way.
    }
  }

  return (
    <div className="interview-stage flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest">
      <StageStyles />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/50 px-4 py-3 md:px-5">
        <span className="hidden w-32 shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70 sm:block">
          Opportunity Radar
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <h1 className="text-sm font-bold tracking-tight text-on-surface md:text-base">
            Live Interview
          </h1>
          {subtitle && (
            <p className="max-w-full truncate text-xs text-on-surface-variant">{subtitle}</p>
          )}
        </div>

        <div className="flex w-32 shrink-0 items-center justify-end gap-2">
          {connected && (
            <>
              <span className="hidden font-mono text-sm tabular-nums text-on-surface-variant sm:inline">
                {formatClock(elapsed)}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-error-container/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-error">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-error" />
                </span>
                Live
              </span>
            </>
          )}
        </div>
      </header>

      {/* ── Body: interviewer | transcript ─────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4 lg:flex-row">
        {/* Interviewer */}
        <section className="relative flex min-h-[22rem] flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface/60">
          <span
            className={`absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${STATE_CHIP[voiceState].className}`}
          >
            <StateDot voiceState={voiceState} />
            {STATE_CHIP[voiceState].label}
          </span>

          {/* LiveKit's own shader visualiser (agents-ui registry). `themeMode`
              is pinned rather than sniffed: next-themes is a dependency here
              but no ThemeProvider is mounted, so the app is light-only and
              the component's `document.documentElement` check would only ever
              be a hydration hazard. */}
          <AgentAudioVisualizerAura
            size="xl"
            state={connected ? state : 'connecting'}
            audioTrack={audioTrack}
            color="#1FD5F9"
            colorShift={0.54}
            themeMode="light"
            className="[mask-image:radial-gradient(circle_at_center,#000_78%,transparent_96%)] size-auto w-[13rem] max-w-[62%] md:w-[16rem] lg:w-[18rem] xl:w-[21rem]"
          />

          <div className="relative text-center">
            <h2 className="text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
              {persona.name}
            </h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-on-surface-variant">{persona.style}</p>
          </div>

          <span className="relative flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container-lowest/80 px-4 py-2 text-sm font-semibold text-on-surface backdrop-blur">
            {statusLine}
          </span>
        </section>

        {/* Transcript */}
        <aside className="flex h-[45vh] flex-col overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface/60 lg:h-auto lg:w-2/5 lg:max-w-[34rem] lg:shrink-0">
          <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/40 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              Transcript
            </span>
            {connected && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Live
              </span>
            )}
          </div>

          <div
            ref={transcriptScrollRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {transcriptions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">
                  forum
                </span>
                <p className="max-w-[16rem] text-xs text-on-surface-variant/70">
                  Your conversation appears here as you speak. Say hello to begin.
                </p>
              </div>
            ) : (
              transcriptions.map((t, i) => {
                const isMe = t.participantInfo.identity === localParticipant.identity
                const key = `${t.participantInfo.identity}-${t.streamInfo?.id ?? i}`
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <span
                      className={`text-[11px] font-semibold ${
                        isMe ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {isMe ? 'You' : persona.name}
                    </span>
                    <p className="text-sm leading-relaxed text-on-surface text-pretty">{t.text}</p>
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-outline-variant/50 px-3 py-3 md:px-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            aria-pressed={!isMicrophoneEnabled}
            aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
            title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
            className={`grid h-12 w-12 cursor-pointer place-items-center rounded-full border transition active:scale-95 ${
              isMicrophoneEnabled
                ? 'border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                : 'border-error/40 bg-error-container/50 text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isMicrophoneEnabled ? 'mic' : 'mic_off'}
            </span>
          </button>

          <DisconnectButton className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-error px-7 py-3.5 text-sm font-bold text-on-error shadow-lg shadow-error/25 transition-all duration-300 hover:brightness-105 hover:shadow-error/40 active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">call_end</span>
            End
          </DisconnectButton>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface/70 py-1 pl-4 pr-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendDraft()
            }}
            placeholder="Type an answer if audio isn't working…"
            aria-label="Type an answer"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none"
          />
          <button
            onClick={sendDraft}
            disabled={!draft.trim() || isSending}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-on-primary transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function StateDot({ voiceState }: { voiceState: VoiceState }) {
  const live = voiceState !== 'idle' && voiceState !== 'connecting'
  return (
    <span className="relative flex h-1.5 w-1.5">
      {live && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      )}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  )
}

/**
 * Only what can't be expressed in utilities: the audio-unlock button is
 * rendered by LiveKit, so it has to be reached by class name.
 */
function StageStyles() {
  return (
    <style>{`
      .interview-stage { isolation: isolate; }

      .lk-start-audio-premium {
        margin: 0 auto 0.75rem; display: block;
        border-radius: 9999px;
        background: var(--color-primary); color: var(--color-on-primary);
        padding: 0.6rem 1.25rem; font-size: 0.8rem; font-weight: 700;
        border: none; cursor: pointer;
      }
    `}</style>
  )
}
