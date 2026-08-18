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
 * the AudioContext. DeepInterview's own live-room.tsx does the same thing;
 * this mirrors that, restyled to Opportunity Radar's tokens rather than
 * rebuilt from scratch.
 *
 * The transcript panel and text-fallback input mirror DeepInterview's own
 * live room (verified against the deployed product), built on LiveKit's
 * standard transcription/chat primitives — useChat's `send()` goes out on
 * LiveKit's standard text-chat channel, which is the conventional mechanism
 * a voice agent listens on for a typed fallback; unverified against a live
 * DeepInterview deployment since none exists yet, worth confirming once one
 * does.
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
      className="flex flex-col items-center gap-4 w-full"
    >
      <RoomAudioRenderer />
      <StartAudio label="Click to enable interview audio" />
      {error && (
        <div className="w-full bg-error-container text-on-error-container rounded-xl p-4 text-sm flex items-center justify-between gap-3">
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

  const stateLabel =
    !connected
      ? 'Connecting…'
      : state === 'speaking'
        ? `${persona.name} speaking`
        : state === 'listening'
          ? 'Listening — go ahead'
          : state === 'thinking'
            ? 'Thinking…'
            : 'Idle'

  useEffect(() => {
    // Scroll the transcript's own scroll container, not scrollIntoView.
    // scrollIntoView walks up and scrolls every scrollable ancestor including
    // the document, so each new turn dragged the whole page down while the
    // candidate was mid-interview. Setting scrollTop moves only this panel.
    //
    // Depends on the transcriptions array reference, not just .length: LiveKit
    // can update an existing segment (partial → final) without changing count,
    // and the scroll should still follow.
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
      // Best-effort — the mic path is the primary one; a failed text send
      // just means the student can retry or speak instead.
    }
  }

  return (
    <div className="w-full flex flex-col md:flex-row gap-4 items-stretch md:h-[calc(100vh-11rem)]">
      {/* Avatar / state stage */}
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">Opportunity Radar · Live</p>
            <p className="text-sm font-semibold text-on-background">{persona.name}</p>
          </div>
          {connected && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              {formatClock(elapsed)}
            </span>
          )}
        </div>

        <div className="relative w-full max-w-sm aspect-square rounded-2xl bg-surface-container-lowest border border-outline-variant flex flex-col items-center justify-center overflow-hidden">
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-surface text-on-surface-variant text-[10px] font-semibold uppercase tracking-wide border border-outline-variant/60">
            {state}
          </span>

          <span
            className={`w-28 h-28 rounded-full bg-gradient-to-br ${persona.gradient} flex items-center justify-center border border-outline-variant/50`}
          >
            <span className="material-symbols-outlined text-on-surface text-[44px]">{persona.icon}</span>
          </span>

          {audioTrack && (
            <BarVisualizer state={state} barCount={7} trackRef={audioTrack} className="h-10 w-full max-w-[180px] mt-4" />
          )}

          <p className="text-sm font-semibold text-on-background mt-3">{persona.name}</p>
          <p className="text-[11px] text-on-surface-variant px-6 text-center mt-0.5">{persona.style}</p>

          {!connected && (
            <span className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-on-surface-variant text-xs border border-outline-variant">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Connecting your interviewer…
            </span>
          )}
        </div>

        <p className="text-xs font-medium text-on-surface-variant">{stateLabel}</p>

        <DisconnectButton className="px-5 py-2.5 rounded-lg bg-error-container text-on-error-container text-sm font-semibold cursor-pointer flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">call_end</span>
          End interview
        </DisconnectButton>
      </div>

      {/* Transcript + text fallback */}
      <div className="flex flex-col bg-surface border border-outline-variant rounded-xl overflow-hidden h-[60vh] md:h-[calc(100vh-11rem)] md:w-[440px] md:shrink-0">
        <div className="px-4 py-2.5 border-b border-outline-variant flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Transcript</span>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-error">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-2.5">
          {transcriptions.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70">The conversation will appear here as you speak.</p>
          ) : (
            transcriptions.map((t, i) => {
              const isMe = t.participantInfo.identity === localParticipant.identity
              // Stable key: participant identity + segment index — survives
              // reorders and deduplication, unlike a bare array index.
              const key = `${t.participantInfo.identity}-${t.streamInfo?.id ?? i}`
              return (
                <div key={key} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] uppercase tracking-wide text-on-surface-variant/60 mb-0.5">
                    {isMe ? 'You' : persona.name}
                  </span>
                  <p
                    className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${
                      isMe ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {t.text}
                  </p>
                </div>
              )
            })
          )}
          <div ref={transcriptEndRef} />
        </div>

        <div className="p-3 border-t border-outline-variant shrink-0 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendDraft() }}
            placeholder="Type an answer if audio isn't working…"
            aria-label="Type an answer"
            className="flex-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={sendDraft}
            disabled={!draft.trim() || isSending}
            aria-label="Send"
            className="p-2 rounded-lg bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
