import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai-gateway'
import {
  submitResume,
  looksLikePdf,
  MAX_RESUME_BYTES,
  AgentError,
  messageForCode,
} from '@/lib/ai-search/agent-client'

/**
 * POST /api/ai-search — start a match run.
 *
 * The browser posts here, never to the agent: the agent has CORS off and its
 * job ids carry no authorization, so it must stay behind our backend. We record
 * the run against the signed-in user, which is what makes polling safe.
 */
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  // Daily cap, on top of the one-at-a-time guard below. That guard stops two
  // runs overlapping but nothing stopped a student starting run after run all
  // day, each costing 5-20 minutes of scraping, Chromium and scoring calls.
  // Same reasoning and mechanism as POST /api/interview/start.
  const allowed = await checkRateLimit(user.id, 'ai_search')
  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'You have run several searches today. Please try again tomorrow.' } },
      { status: 429 }
    )
  }

  // One run at a time per student. The agent is single-threaded and free-tier
  // quota is roughly one student per day, so queueing a second run would just
  // make both slower.
  const { data: active } = await supabase
    .from('ai_search_jobs')
    .select('id, agent_job_id')
    .eq('user_id', user.id)
    .eq('status', 'processing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active) {
    return NextResponse.json(
      { job_id: active.id, already_running: true },
      { status: 200 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: { code: 'MISSING_FILE', message: messageForCode('MISSING_FILE') } },
      { status: 400 }
    )
  }

  const file = form.get('resume')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'MISSING_FILE', message: messageForCode('MISSING_FILE') } },
      { status: 400 }
    )
  }

  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json(
      { error: { code: 'FILE_TOO_LARGE', message: messageForCode('FILE_TOO_LARGE') } },
      { status: 413 }
    )
  }

  // Check the PDF signature ourselves. The agent validates by magic bytes too,
  // but failing here is faster and lets us explain the common case: a .docx
  // renamed to .pdf.
  if (!(await looksLikePdf(file))) {
    return NextResponse.json(
      { error: { code: 'INVALID_FILE_TYPE', message: messageForCode('INVALID_FILE_TYPE') } },
      { status: 415 }
    )
  }

  // Insert-first ordering. The row is written BEFORE the agent is called, so an
  // insert failure means no agent job was ever created — no orphan. (The old
  // order called the agent first, so an insert failure after the agent accepted
  // a job left a 5-20min pipeline running with no row to poll it.) agent_job_id
  // is null for the moment between here and the patch below; the poll route and
  // the age-based timeout both tolerate that.
  const { data: row, error: insertError } = await supabase
    .from('ai_search_jobs')
    .insert({
      user_id: user.id,
      agent_job_id: null,
      status: 'processing',
      resume_filename: file.name || null,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    console.error('[AI Search] could not record job:', insertError?.message)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: messageForCode('INTERNAL_ERROR') } },
      { status: 500 }
    )
  }

  let agentJobId: string
  try {
    agentJobId = await submitResume(file, file.name || 'resume.pdf')
  } catch (e) {
    const err = e instanceof AgentError ? e : new AgentError('INTERNAL_ERROR', String(e))
    console.error('[AI Search] submit failed:', err.code, err.message)
    // The agent never took the job; fail the row we just created so it does not
    // sit in 'processing' until the age timeout, and so the per-user guard frees
    // the student to retry immediately.
    await supabase
      .from('ai_search_jobs')
      .update({ status: 'failed', error: { code: err.code, message: messageForCode(err.code) }, completed_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: { code: err.code, message: messageForCode(err.code) } },
      { status: err.httpStatus }
    )
  }

  // Link the row to the accepted agent job. If this update fails the agent is
  // running but the row has no id yet; the poll route reports 'processing' and
  // the age timeout resolves it — a far rarer and softer failure than the
  // original orphan, since the row exists and the student can see it.
  const { error: patchError } = await supabase
    .from('ai_search_jobs')
    .update({ agent_job_id: agentJobId })
    .eq('id', row.id)
    .eq('user_id', user.id)
  if (patchError) {
    console.error('[AI Search] could not link agent_job_id:', patchError.message)
  }

  return NextResponse.json({ job_id: row.id, status: 'processing' }, { status: 202 })
}

/** GET /api/ai-search — the caller's most recent run, so a reload resumes it. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  const { data } = await supabase
    .from('ai_search_jobs')
    .select('id, status, result, error, created_at, completed_at, resume_filename')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ job: data ?? null })
}
