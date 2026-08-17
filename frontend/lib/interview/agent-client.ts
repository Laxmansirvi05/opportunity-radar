import type { ResumeData } from '@reactive-resume/schema/resume/data'

/**
 * Client for the DeepInterview voice-interview service.
 *
 * Same shape as lib/ai-search/agent-client.ts, deliberately: a separate
 * externally-deployed service, service-to-service only, our server is the
 * only caller. See docs/AI-FEATURES-HANDOFF.md §3 and
 * docs/VOICE-INTERVIEW-INTEGRATION.md for the source contract.
 *
 * Unlike AI Search, this is NOT a simple submit-then-poll job — the actual
 * interview happens over a LiveKit room the browser joins directly (audio
 * never flows through Vercel). This client only handles the two REST calls
 * around that: prep (before the room) and session/score (after).
 */

export const AGENT_BASE_URL = process.env.INTERVIEW_AGENT_URL ?? 'http://localhost:8000'
export const INTERNAL_API_SECRET = process.env.INTERVIEW_AGENT_INTERNAL_SECRET

export class InterviewAgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 502
  ) {
    super(message)
    this.name = 'InterviewAgentError'
  }
}

/** Student-facing copy per error code, mirroring the AI Search client's pattern. */
export const ERROR_COPY: Record<string, string> = {
  AGENT_UNREACHABLE: 'The interview service is not responding right now. Please try again shortly.',
  SESSION_NOT_FOUND: 'We could not find that interview session. Please start a new one.',
  NO_RESUME: 'Add a resume in Resume Builder before starting a mock interview.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
}

export function messageForCode(code: string | undefined): string {
  return (code && ERROR_COPY[code]) || ERROR_COPY.INTERNAL_ERROR
}

function authHeaders(): HeadersInit {
  return INTERNAL_API_SECRET ? { 'X-Internal-Secret': INTERNAL_API_SECRET } : {}
}

// ── CV serialization ────────────────────────────────────────────────────

/** Strip HTML tags from a rich-text field for plain-text LLM input. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Serializes Opportunity Radar's structured resume (Reactive Resume schema)
 * into plain text for DeepInterview's `cv_url` passthrough — per
 * OPPORTUNITY_RADAR_INTEGRATION.md §2, a non-URL string in that field is
 * treated as the CV's raw text directly, no upload or public URL needed.
 * Best-effort: every section is optional and skipped when empty or hidden,
 * never padded with placeholder text for a section that's blank.
 */
export function serializeResumeToText(data: ResumeData): string {
  const lines: string[] = []
  const b = data.basics
  if (b?.name) lines.push(b.name)
  if (b?.headline) lines.push(b.headline)
  const contact = [b?.email, b?.phone, b?.location].filter(Boolean).join(' · ')
  if (contact) lines.push(contact)

  const summary = stripHtml(data.summary?.content)
  if (summary && !data.summary?.hidden) {
    lines.push('', 'SUMMARY', summary)
  }

  const exp = data.sections?.experience
  if (exp && !exp.hidden && exp.items.length > 0) {
    lines.push('', 'EXPERIENCE')
    for (const item of exp.items) {
      if (item.hidden) continue
      const header = [item.position, item.company, item.period].filter(Boolean).join(' · ')
      if (header) lines.push(`- ${header}`)
      const desc = stripHtml(item.description)
      if (desc) lines.push(`  ${desc}`)
    }
  }

  const edu = data.sections?.education
  if (edu && !edu.hidden && edu.items.length > 0) {
    lines.push('', 'EDUCATION')
    for (const item of edu.items) {
      if (item.hidden) continue
      const header = [item.degree, item.area, item.school, item.period].filter(Boolean).join(' · ')
      if (header) lines.push(`- ${header}`)
    }
  }

  const projects = data.sections?.projects
  if (projects && !projects.hidden && projects.items.length > 0) {
    lines.push('', 'PROJECTS')
    for (const item of projects.items) {
      if (item.hidden) continue
      const header = [item.name, item.period].filter(Boolean).join(' · ')
      if (header) lines.push(`- ${header}`)
      const desc = stripHtml(item.description)
      if (desc) lines.push(`  ${desc}`)
    }
  }

  const skills = data.sections?.skills
  if (skills && !skills.hidden && skills.items.length > 0) {
    // Proficiency comes through with the name. The interviewer calibrates
    // difficulty from it — asking a "Beginner" the same depth of question as an
    // "Advanced" wastes a turn — and dropping it threw that signal away.
    const named = skills.items
      .filter((s) => !s.hidden && s.name)
      .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name))
    if (named.length > 0) lines.push('', 'SKILLS', named.join(', '))
  }

  // Certifications and awards were both being dropped. They are among the most
  // interview-relevant things a student has — a Meta Front-End certificate or a
  // hackathon win is exactly what an interviewer opens on — and omitting them
  // left the agent unable to ask about credentials the candidate actually holds.
  const certifications = data.sections?.certifications
  if (certifications && !certifications.hidden && certifications.items.length > 0) {
    const items = certifications.items
      .filter((c) => !c.hidden && c.title)
      .map((c) => `- ${[c.title, c.issuer, c.date].filter(Boolean).join(' · ')}`)
    if (items.length > 0) lines.push('', 'CERTIFICATIONS', ...items)
  }

  const awards = data.sections?.awards
  if (awards && !awards.hidden && awards.items.length > 0) {
    const items = awards.items
      .filter((a) => !a.hidden && a.title)
      .map((a) => `- ${[a.title, a.awarder, a.date].filter(Boolean).join(' · ')}`)
    if (items.length > 0) lines.push('', 'AWARDS', ...items)
  }

  return lines.join('\n').trim()
}

/** Builds a JD text block from an Opportunity Radar opportunity row. */
export function buildJobDescriptionText(opp: {
  title: string
  description: string | null
  skills: string[] | null
  responsibilities: string[] | null
}): string {
  const parts = [opp.title]
  if (opp.description) parts.push(opp.description)
  if (opp.responsibilities?.length) parts.push('Responsibilities: ' + opp.responsibilities.join('; '))
  if (opp.skills?.length) parts.push('Skills: ' + opp.skills.join(', '))
  return parts.join('\n\n')
}

// ── /api/prep ────────────────────────────────────────────────────────────

export interface StartPrepParams {
  cvText: string
  jdText: string | null
  company: string | null
  userId: string
}

async function safeFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    throw new InterviewAgentError(
      'AGENT_UNREACHABLE',
      `Could not reach the interview service at ${AGENT_BASE_URL}: ${(e as Error).message}`,
      503
    )
  }
}

async function parseErrorBody(res: Response): Promise<InterviewAgentError> {
  let message = `Agent responded ${res.status}`
  try {
    const body = (await res.json()) as { detail?: string }
    if (body?.detail) message = body.detail
  } catch {
    /* non-JSON error body */
  }
  return new InterviewAgentError('INTERNAL_ERROR', message, res.status)
}

/**
 * Starts the prep pipeline (CV + JD analysis) and returns the agent's own
 * session id, which becomes the LiveKit room name.
 */
export async function startPrep(params: StartPrepParams): Promise<string> {
  const res = await safeFetch(
    `${AGENT_BASE_URL}/api/prep`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        cv_url: params.cvText,
        jd_text: params.jdText ?? '',
        company: params.company ?? '',
        language_mode: { primary: 'en', mixed: false },
        user_id: params.userId,
      }),
    },
    30_000
  )
  if (!res.ok) throw await parseErrorBody(res)
  const body = (await res.json()) as { session_id?: string }
  if (!body.session_id) {
    throw new InterviewAgentError('INTERNAL_ERROR', 'Agent accepted the prep request but returned no session_id')
  }
  return body.session_id
}

// ── GET /api/session/{id} ───────────────────────────────────────────────

export interface ScoreCard {
  overall_score?: number | null
  summary?: string | null
  competency_scores?: { name: string; score: number; comment?: string | null }[]
  strengths?: string[]
  weaknesses?: string[]
  model_answers?: { question_id: string; answer: string }[]
  language_report?: unknown
  next_steps?: string[]
}

export interface SessionView {
  session_id: string
  status: string // pending | in_progress | complete | no_answers | error | rejected
  context?: {
    job?: { company_name?: string | null; title?: string | null }
    answers?: { question_id: string; transcript: string }[]
    plan?: { questions?: { id: string; text: { en?: string } }[] }
  } | null
  scorecard?: ScoreCard | null
}

/** GET /api/session/{id} — status + prep progress + context + scorecard once scored. */
export async function getSession(externalSessionId: string): Promise<SessionView> {
  const res = await safeFetch(
    `${AGENT_BASE_URL}/api/session/${encodeURIComponent(externalSessionId)}`,
    { headers: authHeaders(), cache: 'no-store' },
    15_000
  )
  if (res.status === 404) {
    throw new InterviewAgentError('SESSION_NOT_FOUND', 'Unknown session_id', 404)
  }
  if (!res.ok) throw await parseErrorBody(res)
  return (await res.json()) as SessionView
}

/**
 * POST /api/score — triggers scoring for a finished session and returns the
 * ScoreCard synchronously if the interview is complete. Called both on the
 * client-detected LiveKit disconnect (fast path) and from our own polling
 * (fallback path) — see OPPORTUNITY_RADAR_CORRECTIONS.md Addition 2 on why
 * the disconnect trigger alone is not reliable.
 */
export async function triggerScore(externalSessionId: string): Promise<ScoreCard | null> {
  const res = await safeFetch(
    `${AGENT_BASE_URL}/api/score`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ session_id: externalSessionId }),
    },
    30_000
  )
  if (res.status === 404) {
    throw new InterviewAgentError('SESSION_NOT_FOUND', 'Unknown session_id', 404)
  }
  if (!res.ok) throw await parseErrorBody(res)
  const body = (await res.json()) as { scorecard?: ScoreCard }
  return body.scorecard ?? null
}
