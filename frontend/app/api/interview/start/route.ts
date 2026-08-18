import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  startPrep,
  serializeResumeToText,
  serializeParsedResumeToText,
  buildJobDescriptionText,
  InterviewAgentError,
  messageForCode,
} from '@/lib/interview/agent-client'
import { checkRateLimit, recordFeatureUsage } from '@/lib/ai-gateway'
import type { ResumeData } from '@reactive-resume/schema/resume/data'
import { ParsedResumeSchema } from '@/types/resume'

/**
 * POST /api/interview/start — begin a mock interview.
 *
 * Body: { opportunity_id?, resume_id?, role?, company?, job_description? }.
 *
 * Two ways to target an interview, and they are not exclusive: pick a real
 * listing (opportunity_id fills role/company/JD from the database), or type
 * them in for a role that isn't listed here. Typed values win where both are
 * present, so a student can pick a listing and then adjust the role.
 *
 * The agent's own /api/prep marks jd_text and company required, so supplying
 * them is the difference between a generic interview and one about the job
 * the student is actually preparing for.
 *
 * Mirrors /api/ai-search's shape — the browser never talks to the agent
 * directly, and the run is recorded against the signed-in user before we
 * ever call out.
 */
export const maxDuration = 60

interface StartBody {
  opportunity_id?: string
  resume_id?: string
  /**
   * A resume uploaded on the intake screen, already extracted to structure by
   * /api/resume/optimization/extract. Sent for this run only and never saved:
   * a student practising against a one-off CV should not have it silently
   * appear in Resume Builder.
   */
  resume_upload?: unknown
  role?: string
  company?: string
  job_description?: string
}

const ROLE_MAX = 120
const COMPANY_MAX = 120
const JD_MAX = 20000

/** Trims and caps a free-text field, returning null for anything empty. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }, { status: 401 })
  }

  // Every other AI-backed route in this app is throttled via callAI's own
  // rate limiting; this route never calls callAI (the LLM work happens
  // inside the separate interview service), so it had no throttle at all
  // until this check — see the voice_interview entry in ai-gateway's
  // RATE_LIMITS.
  const allowed = await checkRateLimit(user.id, 'voice_interview')
  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many interview sessions started recently. Please try again later.' } },
      { status: 429 }
    )
  }

  let body: StartBody
  try {
    body = (await req.json()) as StartBody
  } catch {
    body = {}
  }

  // Two resume sources, in priority order.
  //
  // A resume uploaded on the intake screen wins, because it is the most recent
  // thing the student chose. Otherwise reuse what's already in Resume Builder
  // rather than asking for a second upload — VOICE-INTERVIEW-INTEGRATION.md §3
  // and OPPORTUNITY_RADAR_CORRECTIONS.md Addition 4 are both explicit on that.
  //
  // The upload branch matters more than it looks: a student whose account has
  // no saved resume can only get in this way, and without it the intake screen
  // accepted a PDF, enabled Start, and then failed here with NO_RESUME.
  let cvText: string | null = null
  let resumeId: string | null = null

  const uploaded = ParsedResumeSchema.safeParse(body.resume_upload)
  if (uploaded.success) {
    cvText = serializeParsedResumeToText(uploaded.data)
  } else {
    const resumeQuery = supabase
      .from('resumes')
      .select('id, parsed_data')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    const { data: resume } = body.resume_id
      ? await supabase.from('resumes').select('id, parsed_data').eq('id', body.resume_id).eq('user_id', user.id).maybeSingle()
      : await resumeQuery.maybeSingle()

    if (resume?.parsed_data) {
      cvText = serializeResumeToText(resume.parsed_data as ResumeData)
      resumeId = resume.id
    }
  }

  if (!cvText) {
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

  // Typed values override whatever the listing supplied: the student is
  // looking at the form, so what they typed is the more recent intent.
  roleTitle = cleanText(body.role, ROLE_MAX) ?? roleTitle
  company = cleanText(body.company, COMPANY_MAX) ?? company
  jdText = cleanText(body.job_description, JD_MAX) ?? jdText

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
      resume_id: resumeId,
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

  // Count this accepted session against the daily limit. checkRateLimit above
  // only READS the count (from ai_usage_log); like AI Search, the interview
  // never routes through callAI, so without this record the voice_interview
  // limit was a no-op — the persistent count stayed at 0 and only the
  // unreliable in-memory map incremented. Recorded only for a session that was
  // actually created; best-effort. See recordFeatureUsage / the AI Search fix.
  await recordFeatureUsage(user.id, 'voice_interview')

  return NextResponse.json({ session_id: session.id }, { status: 202 })
}
