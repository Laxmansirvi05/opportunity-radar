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
  agent_status?: string
  prep_progress?: string[]
  transient_error?: string
  error?: { code: string; message: string }
}

/** The agent's own prep step keys, in the order it runs them. */
const PREP_STEPS: { key: string; label: string }[] = [
  { key: 'cv_analysis', label: 'Reading your resume' },
  { key: 'jd_analysis', label: 'Reading the job description' },
  { key: 'company_research', label: 'Looking up the company' },
  { key: 'gap_matching', label: 'Comparing you to the role' },
  { key: 'question_planner', label: 'Writing your questions' },
]

/** Prep gate: how often to re-check, and how long before giving up. Prep is a
 *  five-node LLM pipeline, so a minute is normal and three is the ceiling. */
const PREP_POLL_MS = 2_500
const PREP_TIMEOUT_MS = 3 * 60_000

/** Poll cadence while waiting for the agent to finish scoring — the room
 *  itself is real-time, this only applies after disconnect. Starts at 2s and
 *  doubles each round (capped at 15s) so we're fast for the happy path but
 *  gentle on the server for a slow score. */
const SCORE_POLL_INITIAL_MS = 2_000
const SCORE_POLL_MAX_MS = 15_000
// Scoring is a heavy pass — it grades every competency AND writes a model
// answer for each question, which on a longer interview measured ~4 min end to
// end. Three minutes cut it off just before it finished and showed a scary
// "something went wrong" even though the report was seconds away. Give it real
// headroom; the answers are already saved, so the only cost of waiting is the
// spinner. See the "Scoring your interview" copy for the expectation we set.
const SCORE_POLL_TIMEOUT_MS = 8 * 60_000

export function InterviewSession({ sessionId, personaId }: { sessionId: string; personaId: string | null }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [meta, setMeta] = useState<{ role: string | null; company: string | null }>({ role: null, company: null })
  const [report, setReport] = useState<{ scorecard: ScoreCard; degraded: boolean } | null>(null)
  const [liveKit, setLiveKit] = useState<{ token: string; url: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Prep steps completed so far, shown while waiting so a 45-60s wait reads as
  // progress rather than a hang.
  const [prepProgress, setPrepProgress] = useState<string[]>([])
  const [prepWarnings, setPrepWarnings] = useState<string[]>([])
  const scorePollStarted = useRef<number | null>(null)
  const scorePollInterval = useRef(SCORE_POLL_INITIAL_MS)

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
        } else if (body.status === 'completed') {
          // Completed but the report hasn't arrived on this response (e.g. it is
          // being re-fetched/finalized server-side). NEVER drop into 'preflight'
          // here — that re-opens the live interview and loses the score. Poll for
          // the report instead, exactly like the post-interview path.
          scorePollStarted.current = Date.now()
          scorePollInterval.current = SCORE_POLL_INITIAL_MS
          setPhase('scoring')
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
      // Wait for prep before joining. The room is created the moment a token is
      // minted, which dispatches the worker; if the question plan is not built
      // yet the worker logs "no InterviewContext for session" and aborts, and
      // the candidate is left staring at CONNECTING with no interviewer and no
      // error. Prep runs 45-60s, so this gap is the normal case, not an edge
      // one — the old code called /token immediately and hit it every time.
      const deadline = Date.now() + PREP_TIMEOUT_MS
      for (;;) {
        const statusRes = await fetch(`/api/interview/${sessionId}`, { cache: 'no-store' })
        const status = await statusRes.json().catch(() => null)
        // A terminal status here means the session ended before it began;
        // fall through and let the normal handling report it.
        if (!statusRes.ok || status?.status !== 'in_progress') break
        const agentStatus = status?.agent_status
        if (agentStatus && agentStatus !== 'prep') break
        setPrepProgress(Array.isArray(status?.prep_progress) ? status.prep_progress : [])
        if (Array.isArray(status?.prep_warnings) && status.prep_warnings.length > 0) {
          setPrepWarnings(status.prep_warnings)
        }
        if (Date.now() > deadline) {
          setErrorMessage(
            'The interviewer is taking longer than expected to prepare. Please try starting again.'
          )
          setPhase('error')
          return
        }
        await new Promise((r) => setTimeout(r, PREP_POLL_MS))
      }

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
    scorePollInterval.current = SCORE_POLL_INITIAL_MS
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
        setTimeout(poll, scorePollInterval.current)
        scorePollInterval.current = Math.min(scorePollInterval.current * 2, SCORE_POLL_MAX_MS)
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
      setTimeout(poll, scorePollInterval.current)
      scorePollInterval.current = Math.min(scorePollInterval.current * 2, SCORE_POLL_MAX_MS)
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
    // Named steps, not a bare spinner: this wait is the agent reading the CV
    // and the job description and writing a question plan, which takes the best
    // part of a minute. Showing which steps are done makes that legible as work
    // rather than as a hang, and it is the same progress the agent publishes.
    const done = new Set(prepProgress)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20">
        <p className="font-title-md text-title-md text-on-surface">Getting your interviewer ready</p>
        <p className="font-body-sm text-body-sm text-center text-on-surface-variant">
          It&apos;s reading your resume and the job description, then writing questions for this
          specific role. This takes about a minute.
        </p>
        <ul className="mt-2 flex w-full flex-col gap-2">
          {PREP_STEPS.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`material-symbols-outlined text-[18px] ${
                  done.has(s.key) ? 'text-primary' : 'text-on-surface-variant/40'
                }`}
              >
                {done.has(s.key) ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span
                className={`font-body-sm text-body-sm ${
                  done.has(s.key) ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ul>
        {prepWarnings.length > 0 && (
          <div className="mt-3 flex w-full flex-col gap-1.5 rounded-xl border border-outline-variant bg-tertiary-container/30 px-4 py-3">
            {prepWarnings.map((w, i) => (
              <p key={i} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface">
                <span className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">info</span>
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (phase === 'live' && liveKit) {
    return <LiveRoom token={liveKit.token} serverUrl={liveKit.url} personaId={personaId} onEnded={handleEnded} />
  }

  if (phase === 'scoring') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" aria-hidden />
        <div className="w-full">
          <h1 className="text-lg font-bold text-on-background">Building your report…</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Grading every answer against the role, then writing a model answer for each
            question. This usually takes <span className="font-semibold text-on-surface">2–3 minutes</span> —
            it updates on its own, and your answers are already saved.
          </p>
        </div>
        <ul className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
          {[
            'Scoring each competency',
            'Reviewing your spoken answers',
            'Writing model answers & next steps',
          ].map((label) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {label}
            </li>
          ))}
        </ul>
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
