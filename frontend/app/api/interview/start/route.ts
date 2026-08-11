import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  startPrep,
  serializeResumeToText,
  buildJobDescriptionText,
  InterviewAgentError,
  messageForCode,
} from '@/lib/interview/agent-client'
import type { ResumeData } from '@reactive-resume/schema/resume/data'

/**
 * POST /api/interview/start — begin a mock interview.
 *
 * Body: { opportunity_id?: string, resume_id?: string }. Both optional:
 * an interview can be practised standalone (no JD) or for a specific
 * listing. Mirrors /api/ai-search's shape — the browser never talks to
 * the agent directly, and the run is recorded against the signed-in user
 * before we ever call out.
 */
export const maxDuration = 60

interface StartBody {
  opportunity_id?: string
  resume_id?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  let body: StartBody
  try {
    body = (await req.json()) as StartBody
  } catch {
    body = {}
  }

  // Resume: reuse what's already in Resume Builder rather than asking for a
  // second upload — VOICE-INTERVIEW-INTEGRATION.md §3 and
  // OPPORTUNITY_RADAR_CORRECTIONS.md Addition 4 are both explicit about this.
  const resumeQuery = supabase
    .from('resumes')
    .select('id, parsed_data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
  const { data: resume } = body.resume_id
    ? await supabase.from('resumes').select('id, parsed_data').eq('id', body.resume_id).eq('user_id', user.id).maybeSingle()
    : await resumeQuery.maybeSingle()

  if (!resume?.parsed_data) {
    return NextResponse.json(
      { error: { code: 'NO_RESUME', message: messageForCode('NO_RESUME') } },
      { status: 422 }
    )
  }

  let opportunityId: string | null = null
  let roleTitle: string | null = null
  let company: string | null = null
  let jdText: string | null = null

  if (body.opportunity_id) {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id, title, description, skills, responsibilities, companies(name)')
      .eq('id', body.opportunity_id)
      .maybeSingle()
    if (opp) {
      opportunityId = opp.id
      roleTitle = opp.title
      company = (opp.companies as unknown as { name?: string } | null)?.name ?? null
      jdText = buildJobDescriptionText(opp)
    }
  }

  const cvText = serializeResumeToText(resume.parsed_data as ResumeData)

  let externalSessionId: string
  try {
    externalSessionId = await startPrep({
      cvText,
      jdText,
      company,
      userId: user.id,
    })
  } catch (e) {
    const err = e instanceof InterviewAgentError ? e : new InterviewAgentError('INTERNAL_ERROR', String(e))
    console.error('[Interview] prep failed:', err.code, err.message)
    return NextResponse.json(
      { error: { code: err.code, message: messageForCode(err.code) } },
      { status: err.httpStatus }
    )
  }

  const { data: session, error: insertError } = await supabase
    .from('interview_sessions')
    .insert({
      user_id: user.id,
      opportunity_id: opportunityId,
      resume_id: resume.id,
      role_title: roleTitle,
      company,
      status: 'pending',
      external_session_id: externalSessionId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !session) {
    console.error('[Interview] could not record session:', insertError?.message)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: messageForCode('INTERNAL_ERROR') } },
      { status: 500 }
    )
  }

  return NextResponse.json({ session_id: session.id }, { status: 202 })
}
