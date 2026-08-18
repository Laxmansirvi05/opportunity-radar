import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchJob, AgentError, messageForCode, POLL_TIMEOUT_MS } from '@/lib/ai-search/agent-client'

/**
 * GET /api/ai-search/:jobId — poll one run.
 *
 * `jobId` is OUR row id, not the agent's. The agent has no per-user
 * authorization — anyone holding its job id can read that run — so we never
 * expose it. The ownership filter below is the access control.
 *
 * Once a run is terminal the stored payload is served directly and the agent is
 * not contacted again.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  const { data: job } = await supabase
    .from('ai_search_jobs')
    .select('id, agent_job_id, status, result, error, created_at, resume_filename')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!job) {
    return NextResponse.json(
      { error: { code: 'JOB_NOT_FOUND', message: messageForCode('JOB_NOT_FOUND') } },
      { status: 404 }
    )
  }

  // Terminal already — no need to bother the agent.
  if (job.status === 'complete' || job.status === 'failed') {
    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      created_at: job.created_at,
    })
  }

  // The agent sweeps at 30 minutes, so polling past that tells us nothing new.
  const ageMs = Date.now() - new Date(job.created_at).getTime()
  if (ageMs > POLL_TIMEOUT_MS) {
    const timeoutError = { code: 'PIPELINE_TIMEOUT', message: messageForCode('PIPELINE_TIMEOUT') }
    await supabase
      .from('ai_search_jobs')
      .update({ status: 'failed', error: timeoutError, completed_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('user_id', user.id)

    return NextResponse.json({ job_id: job.id, status: 'failed', error: timeoutError })
  }

  // agent_job_id can be null in the brief insert-first window (the row is
  // written before the agent is called). A later request can surface such a
  // row via the active-job guard, so treat "no agent id yet" as still starting
  // rather than calling fetchJob(null). The age-based PIPELINE_TIMEOUT above is
  // the backstop if it never gets set (e.g. the agent_job_id update failed).
  if (!job.agent_job_id) {
    return NextResponse.json({ job_id: job.id, status: 'processing' })
  }

  let agentJob
  try {
    agentJob = await fetchJob(job.agent_job_id)
  } catch (e) {
    const err = e instanceof AgentError ? e : new AgentError('INTERNAL_ERROR', String(e))

    // A transient outage must not kill a run that may still be executing —
    // report it as still processing and let the client keep polling.
    if (err.code === 'AGENT_UNREACHABLE') {
      return NextResponse.json({
        job_id: job.id,
        status: 'processing',
        transient_error: messageForCode(err.code),
        created_at: job.created_at,
      })
    }

    console.error('[AI Search] poll failed:', err.code, err.message)
    return NextResponse.json(
      { error: { code: err.code, message: messageForCode(err.code) } },
      { status: err.httpStatus }
    )
  }

  if (agentJob.status === 'complete' && agentJob.result) {
    await supabase
      .from('ai_search_jobs')
      .update({ status: 'complete', result: agentJob.result, completed_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('user_id', user.id)

    return NextResponse.json({
      job_id: job.id,
      status: 'complete',
      result: agentJob.result,
      created_at: job.created_at,
    })
  }

  if (agentJob.status === 'failed') {
    const failure = agentJob.error ?? { code: 'PIPELINE_FAILED', message: 'The run did not finish.' }
    const stored = { code: failure.code, message: messageForCode(failure.code) }

    await supabase
      .from('ai_search_jobs')
      .update({ status: 'failed', error: stored, completed_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('user_id', user.id)

    return NextResponse.json({ job_id: job.id, status: 'failed', error: stored })
  }

  return NextResponse.json({ job_id: job.id, status: 'processing', created_at: job.created_at })
}
