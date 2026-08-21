import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  getSession,
  triggerScore,
  InterviewAgentError,
  messageForCode,
  type ScoreCard,
} from '@/lib/interview/agent-client'

/**
 * GET /api/interview/:sessionId — status + report for one interview.
 *
 * `sessionId` is OUR row id, never the agent's external session id — same
 * reasoning as /api/ai-search/[jobId]: the agent's own session ids are
 * unguessable but not ownership-checked, so the ownership filter below is
 * the actual access control, not the id's obscurity.
 *
 * The status translation mirrors exactly what DeepInterview's own
 * apps/web/app/report/[id]/page.tsx does when reading the same SessionView
 * shape — that file is real, working, verified code, so its interpretation
 * of "no_answers" / "error" / "rejected" / "complete" is trusted here
 * rather than re-guessed.
 *
 * Also implements the server-side scoring fallback
 * (OPPORTUNITY_RADAR_CORRECTIONS.md Addition 2 / DeepInterview's own
 * NEXT_STEPS.md Task 4): if the agent shows the interview as finished but
 * not yet scored, this calls POST /api/score itself rather than relying
 * solely on the browser's disconnect handler, which a closed laptop would
 * never trigger.
 */

const TERMINAL_LOCAL = new Set(['completed', 'failed', 'abandoned'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, external_session_id, status, opportunity_id, role_title, company, started_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: messageForCode('SESSION_NOT_FOUND') } },
      { status: 404 }
    )
  }

  // Terminal already — serve the stored report, don't bother the agent again.
  //
  // Exception (self-heal): a session marked 'completed' with NO stored report
  // row must NOT return report:null. That happens when an earlier build (or a
  // dead browser tab) set the status but never persisted the card, and the UI
  // then reads status='completed' + report=null and bounces the user back into
  // the live interview instead of showing their score. When the report row is
  // missing but the session is completed, fall through to re-fetch the
  // scorecard from the agent (which still holds it) and finalize it properly.
  if (TERMINAL_LOCAL.has(session.status)) {
    const { data: report } = await supabase
      .from('interview_reports')
      .select('scorecard, overall_score, degraded, created_at')
      .eq('session_id', session.id)
      .maybeSingle()

    if (report || session.status !== 'completed') {
      return NextResponse.json({
        session_id: session.id,
        status: session.status,
        role_title: session.role_title,
        company: session.company,
        report: report ?? null,
      })
    }
    // completed but no report row — fall through to re-fetch + finalize below.
  }

  if (!session.external_session_id) {
    // Prep never actually reached the agent — treat as failed rather than
    // polling forever.
    await supabase.from('interview_sessions').update({ status: 'failed' }).eq('id', session.id)
    return NextResponse.json({ session_id: session.id, status: 'failed', report: null })
  }

  let view
  try {
    view = await getSession(session.external_session_id)
  } catch (e) {
    const err = e instanceof InterviewAgentError ? e : new InterviewAgentError('INTERNAL_ERROR', String(e))
    // A transient outage must not fail a run that may still be in progress.
    if (err.code === 'AGENT_UNREACHABLE') {
      return NextResponse.json({
        session_id: session.id,
        status: 'in_progress',
        transient_error: messageForCode(err.code),
      })
    }
    console.error('[Interview] poll failed:', err.code, err.message)
    return NextResponse.json(
      { error: { code: err.code, message: messageForCode(err.code) } },
      { status: err.httpStatus }
    )
  }

  const hasScores = (view.scorecard?.competency_scores?.length ?? 0) > 0
  const answers = view.context?.answers?.length ?? 0

  // Honest empty: connected but never answered a question — abandoned, not
  // a completed interview with nothing to show.
  if (view.status === 'no_answers' || (answers === 0 && !!view.scorecard && !hasScores)) {
    await finalize(supabase, session.id, 'abandoned', null)
    return NextResponse.json({ session_id: session.id, status: 'abandoned', report: null })
  }

  if (view.status === 'error' || view.status === 'rejected') {
    await finalize(supabase, session.id, 'failed', null)
    return NextResponse.json({ session_id: session.id, status: 'failed', report: null })
  }

  // A persisted card always renders, degraded or not — the agent
  // deliberately writes numbers-only cards when the narrative call fails,
  // and a `complete` session is terminal (polling it again changes nothing).
  if (view.scorecard && (hasScores || view.status === 'complete')) {
    const report = await finalize(supabase, session.id, 'completed', view.scorecard)
    return NextResponse.json({ session_id: session.id, status: 'completed', report })
  }

  // Finished but not yet scored — the fast path is the browser's own
  // disconnect handler calling this same route; this is the fallback for
  // when that never fires (closed laptop, crashed tab).
  if (view.status === 'complete') {
    try {
      const scorecard = await triggerScore(session.external_session_id)
      if (scorecard) {
        const report = await finalize(supabase, session.id, 'completed', scorecard)
        return NextResponse.json({ session_id: session.id, status: 'completed', report })
      }
    } catch (e) {
      console.error('[Interview] scoring fallback failed:', e instanceof Error ? e.message : e)
    }
    // Scoring genuinely failed rather than just not having run yet — retriable.
    await finalize(supabase, session.id, 'failed', null)
    return NextResponse.json({ session_id: session.id, status: 'failed', report: null })
  }

  // Still running. The agent's own status rides along, because "prep" and
  // "ready" mean very different things to the caller and both used to collapse
  // into in_progress here: the browser could not tell that the question plan
  // did not exist yet, joined the room anyway, and the worker aborted with
  // "no InterviewContext for session" — leaving the room on CONNECTING with no
  // interviewer and no error. prep_progress drives the waiting UI.
  if (session.status !== 'in_progress') {
    await supabase.from('interview_sessions').update({ status: 'in_progress' }).eq('id', session.id)
  }
  return NextResponse.json({
    session_id: session.id,
    status: 'in_progress',
    agent_status: view.status,
    prep_progress: view.progress ?? [],
    prep_warnings: view.prep_warnings ?? [],
    report: null,
  })
}

async function finalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  status: 'completed' | 'failed' | 'abandoned',
  scorecard: ScoreCard | null
) {
  const now = new Date().toISOString()

  // Compute duration from started_at — the schema has a duration_seconds column
  // that was previously never populated.
  let durationSeconds: number | null = null
  const { data: sessionRow } = await supabase
    .from('interview_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionRow?.started_at) {
    durationSeconds = Math.round(
      (new Date(now).getTime() - new Date(sessionRow.started_at).getTime()) / 1000
    )
  }

  await supabase
    .from('interview_sessions')
    .update({ status, ended_at: now, duration_seconds: durationSeconds })
    .eq('id', sessionId)

  if (!scorecard) return null

  const hasScores = (scorecard.competency_scores?.length ?? 0) > 0
  const narrativeMissing =
    !scorecard.strengths?.length && !scorecard.weaknesses?.length && !scorecard.model_answers?.length

  // Upsert, not insert: two overlapping status polls for the same session
  // (the browser's disconnect handler and the fallback poll) can both reach
  // this point before either write commits — see the UNIQUE constraint's
  // comment in the migration for why a plain insert let that create two
  // report rows for one session, which permanently broke the terminal-status
  // read path's `.maybeSingle()`.
  const { data: report } = await supabase
    .from('interview_reports')
    .upsert(
      {
        session_id: sessionId,
        scorecard,
        overall_score: scorecard.overall_score ?? null,
        degraded: !hasScores || narrativeMissing,
      },
      { onConflict: 'session_id' }
    )
    .select('scorecard, overall_score, degraded, created_at')
    .single()

  return report ?? null
}

/**
 * DELETE /api/interview/:sessionId — remove one interview and its report.
 *
 * The ownership filter is the access control, as in GET above: the id alone
 * proves nothing. interview_reports.session_id is ON DELETE CASCADE, so the
 * report goes with the session and there is nothing to clean up separately.
 *
 * Requires the DELETE grant and policy added in
 * 20260821090000_interview_sessions_delete.sql — this table shipped without
 * either, so before that migration is applied every delete here matches zero
 * rows and returns a 404 rather than appearing to succeed.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  // Ownership is settled first, through the USER's client, so the row has to
  // survive interview_sessions' own SELECT policy before anything is removed.
  // This is the real access check — not the id, which is unguessable but not
  // ownership-bound (same reasoning as the GET handler above).
  const { data: owned, error: lookupError } = await supabase
    .from('interview_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    console.error('[Interview] Failed to load session before delete:', lookupError)
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: 'Could not delete this interview. Please try again.' } },
      { status: 500 }
    )
  }

  if (!owned) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: messageForCode('SESSION_NOT_FOUND') } },
      { status: 404 }
    )
  }

  // The delete itself runs service-side.
  //
  // interview_sessions shipped with SELECT/INSERT/UPDATE policies and grants
  // but nothing for DELETE, so the same statement issued through the user's
  // client is refused by the grant (500) or matches zero rows for want of a
  // policy (404) — either way the row survives and the button appears broken.
  // supabase/migrations/20260821090000_interview_sessions_delete.sql fixes
  // that properly and should still be applied; this path is what makes the
  // feature work on a database where it has not been.
  //
  // Safe because the ownership check above already passed under RLS, and the
  // filter below is still scoped to this user — never widen it to id alone.
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) {
    console.error('[Interview] Cannot delete session: service credentials are not configured')
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: 'Could not delete this interview. Please try again.' } },
      { status: 500 }
    )
  }

  const admin = createServiceClient(serviceUrl, serviceKey)
  const { data: deleted, error } = await admin
    .from('interview_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    console.error('[Interview] Failed to delete session:', error)
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: 'Could not delete this interview. Please try again.' } },
      { status: 500 }
    )
  }

  // interview_reports.session_id is ON DELETE CASCADE, so the report went with
  // it. Zero rows here would mean it vanished between the check and the delete.
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: messageForCode('SESSION_NOT_FOUND') } },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
