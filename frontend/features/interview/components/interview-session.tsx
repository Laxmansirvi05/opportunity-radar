'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { PreFlightCheck } from './pre-flight-check'
import { LiveRoom } from './live-room'
import { ReportView } from './report-view'
import type { ScoreCard } from '@/lib/interview/agent-client'

type Phase = 'loading' | 'preflight' | 'connecting' | 'live' | 'scoring' | 'report' | 'abandoned' | 'failed' | 'error'

interface StatusResponse {
  session_id: string
  status: string
  role_title?: string | null
  company?: string | null
  report?: { scorecard: ScoreCard; overall_score: number | null; degraded: boolean } | null
  transient_error?: string
  error?: { code: string; message: string }
}

/** Poll cadence while waiting for the agent to finish scoring — the room
 *  itself is real-time, this only applies after disconnect. */
const SCORE_POLL_MS = 4_000
const SCORE_POLL_TIMEOUT_MS = 3 * 60_000

export function InterviewSession({ sessionId, personaId }: { sessionId: string; personaId: string | null }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [meta, setMeta] = useState<{ role: string | null; company: string | null }>({ role: null, company: null })
  const [report, setReport] = useState<{ scorecard: ScoreCard; degraded: boolean } | null>(null)
  const [liveKit, setLiveKit] = useState<{ token: string; url: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const scorePollStarted = useRef<number | null>(null)

  const fetchStatus = useCallback(async (): Promise<StatusResponse | null> => {
    const res = await fetch(`/api/interview/${sessionId}`, { cache: 'no-store' })
    const body = (await res.json()) as StatusResponse
    if (!res.ok) {
      setErrorMessage(body.error?.message ?? 'Something went wrong loading your interview.')
      setPhase('error')
      return null
    }
    return body
  }, [sessionId])

  // Initial load. fetchStatus only handles non-2xx responses itself (and
  // already sets the error phase for those) — a network-level failure
  // (offline, DNS hiccup, res.json() on a non-JSON body) throws instead of
  // resolving, so it needs its own catch here or the phase gets stuck on
  // 'loading' forever with nothing on screen and no way to retry.
  useEffect(() => {
    let cancelled = false
    // This effect kicks off an async fetch whose first statement flips a
    // loading flag. The rule fires on that synchronous setState, but moving it
    // after the await would mean the spinner only appears once the request is
    // already in flight — a worse experience traded for a green lint line.
    // Same justification convention as hub-message.tsx and tracker-board.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus()
      .then((body) => {
        if (cancelled || !body) return
        setMeta({ role: body.role_title ?? null, company: body.company ?? null })
        if (body.status === 'completed' && body.report) {
          setReport({ scorecard: body.report.scorecard, degraded: body.report.degraded })
          setPhase('report')
        } else if (body.status === 'abandoned') {
          setPhase('abandoned')
        } else if (body.status === 'failed') {
          setPhase('failed')
        } else {
          setPhase('preflight')
        }
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Something went wrong loading your interview.')
        setPhase('error')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const startCall = useCallback(async () => {
    setPhase('connecting')
    try {
      const res = await fetch(`/api/interview/${sessionId}/token`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setErrorMessage(body.error?.message ?? 'Could not connect to the interview room.')
        setPhase('error')
        return
      }
      setLiveKit({ token: body.token, url: body.url })
      setPhase('live')
    } catch {
      setErrorMessage('Could not connect to the interview room.')
      setPhase('error')
    }
  }, [sessionId])

  // Room ended (disconnect, hangup, or error) — start polling for the score.
  // The GET route itself triggers scoring server-side if the browser is the
  // first to notice completion; this poll is also the fallback path for
  // when it isn't (closed laptop, crashed tab) — see interview_sessions
  // migration + the [sessionId] route's own comment on why.
  const handleEnded = useCallback(() => {
    scorePollStarted.current = Date.now()
    setPhase('scoring')
  }, [])

  useEffect(() => {
    if (phase !== 'scoring') return
    let cancelled = false

    const poll = async () => {
      let body: StatusResponse | null
      try {
        body = await fetchStatus()
      } catch {
        // Network-level failure (not a non-2xx response — fetchStatus
        // already sets the error phase for those and returns null, which
        // falls through to `return` below). Treat this as transient and
        // just retry on the next tick instead of freezing the spinner.
        if (cancelled) return
        const elapsed = Date.now() - (scorePollStarted.current ?? Date.now())
        if (elapsed > SCORE_POLL_TIMEOUT_MS) {
          setErrorMessage('Scoring is taking longer than expected. Check back on this page shortly — your answers are saved.')
          setPhase('error')
          return
        }
        setTimeout(poll, SCORE_POLL_MS)
        return
      }
      if (cancelled || !body) return

      if (body.status === 'completed' && body.report) {
        setReport({ scorecard: body.report.scorecard, degraded: body.report.degraded })
        setPhase('report')
        return
      }
      if (body.status === 'abandoned') {
        setPhase('abandoned')
        return
      }
      if (body.status === 'failed') {
        setPhase('failed')
        return
      }

      const elapsed = Date.now() - (scorePollStarted.current ?? Date.now())
      if (elapsed > SCORE_POLL_TIMEOUT_MS) {
        setErrorMessage('Scoring is taking longer than expected. Check back on this page shortly — your answers are saved.')
        setPhase('error')
        return
      }
      setTimeout(poll, SCORE_POLL_MS)
    }

    poll()
    return () => { cancelled = true }
  }, [phase, fetchStatus])

  if (phase === 'loading') {
    return <div className="flex items-center justify-center py-20 text-sm text-on-surface-variant">Loading…</div>
  }

  if (phase === 'preflight') {
    return <PreFlightCheck onReady={startCall} />
  }

  if (phase === 'connecting') {
    return <div className="flex items-center justify-center py-20 text-sm text-on-surface-variant">Connecting to the interviewer…</div>
  }

  if (phase === 'live' && liveKit) {
    return <LiveRoom token={liveKit.token} serverUrl={liveKit.url} personaId={personaId} onEnded={handleEnded} />
  }

  if (phase === 'scoring') {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <div className="w-full max-w-sm">
          <h1 className="font-bold text-on-background">Scoring your interview…</h1>
          <p className="text-sm text-on-surface-variant mt-1">This updates automatically — no need to refresh.</p>
        </div>
      </div>
    )
  }

  if (phase === 'report' && report) {
    return <ReportView scorecard={report.scorecard} degraded={report.degraded} roleTitle={meta.role} company={meta.company} />
  }

  if (phase === 'abandoned') {
    return (
      <StatusCard
        title="No answers recorded"
        body="This interview ended before any question was answered, so there's nothing to score. Give it another go when you're ready."
      />
    )
  }

  if (phase === 'failed') {
    return (
      <StatusCard
        title="We couldn't score this interview"
        body="Scoring hit a temporary error rather than showing an inaccurate result. This is retriable — try starting a new interview."
      />
    )
  }

  return (
    <StatusCard title="Something went wrong" body={errorMessage ?? 'Please try again.'} />
  )
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-8 flex flex-col items-center text-center gap-3">
      <h1 className="font-bold text-on-background">{title}</h1>
      <p className="text-sm text-on-surface-variant max-w-sm w-full">{body}</p>
      <Link
        href="/interview"
        className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
      >
        Start a new interview
      </Link>
    </div>
  )
}
