'use client'

import { useState, useCallback } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  BarVisualizer,
  useConnectionState,
  DisconnectButton,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import '@livekit/components-styles'

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
 */
export function LiveRoom({
  token,
  serverUrl,
  onEnded,
}: {
  token: string
  serverUrl: string
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
      className="flex flex-col items-center gap-6"
    >
      <RoomAudioRenderer />
      <StartAudio label="Click to enable interview audio" />
      {error && (
        <div className="w-full bg-error-container text-on-error-container rounded-xl p-4 text-sm">
          {error}
        </div>
      )}
      <RoomStage />
    </LiveKitRoom>
  )
}

function RoomStage() {
  const { state, audioTrack } = useVoiceAssistant()
  const connectionState = useConnectionState()

  const label =
    connectionState !== ConnectionState.Connected
      ? 'Connecting…'
      : state === 'speaking'
        ? 'Interviewer speaking'
        : state === 'listening'
          ? 'Listening — go ahead'
          : state === 'thinking'
            ? 'Thinking…'
            : 'Connected'

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="w-full max-w-md h-40 rounded-2xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center overflow-hidden">
        {audioTrack ? (
          <BarVisualizer state={state} barCount={7} trackRef={audioTrack} className="h-20 w-full max-w-xs" />
        ) : (
          <span className="material-symbols-outlined text-outline text-[40px]">graphic_eq</span>
        )}
      </div>

      <p className="text-sm font-medium text-on-surface-variant">{label}</p>

      <DisconnectButton className="px-5 py-2.5 rounded-lg bg-error-container text-on-error-container text-sm font-semibold cursor-pointer flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">call_end</span>
        End interview
      </DisconnectButton>

      <p className="text-xs text-on-surface-variant/70 max-w-sm text-center">
        Audio-only — nothing is recorded on video. Losing connection mid-interview will end the session; you can retry afterward.
      </p>
    </div>
  )
}
