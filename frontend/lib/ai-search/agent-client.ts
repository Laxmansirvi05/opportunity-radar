/**
 * Client for the internship-matching agent.
 *
 * The agent is a separate service (job-server, :4300 by default). Its
 * integration guide is explicit that this is **service-to-service only** — CORS
 * is off and job ids carry no per-user authorization, so anyone holding one can
 * read that run. Every call therefore originates here, on our server, never
 * from the browser.
 *
 * Two operations: submit a PDF, then poll.
 */

export const AGENT_BASE_URL = process.env.AI_AGENT_URL ?? 'http://localhost:4300'

/**
 * job-server itself has no internal-auth concept — the shared secret is
 * enforced at the reverse-proxy layer in front of it (see the agent repo's
 * deploy/Caddyfile), which is what actually makes it safe to have
 * AI_AGENT_URL be a public hostname instead of a private-network-only
 * address. Unset locally (dev talks to job-server directly on localhost,
 * no proxy in the way); required once deployed behind Caddy.
 */
function agentAuthHeaders(): HeadersInit {
  const secret = process.env.AI_AGENT_INTERNAL_SECRET
  return secret ? { 'X-Internal-Secret': secret } : {}
}

/** Poll cadence and ceiling, both taken from the agent's guide. */
export const POLL_INTERVAL_MS = 15_000
export const POLL_TIMEOUT_MS = 30 * 60_000

/** Observed end-to-end runtimes: 78s, 402s, 484s, 781s. */
export const TYPICAL_RUNTIME_MIN = 5
export const MAX_RUNTIME_MIN = 20

export const MAX_RESUME_BYTES = 5 * 1024 * 1024

export type ResultTier = 'full' | 'good' | 'limited' | 'very_limited' | 'none'
export type AgentStatus = 'processing' | 'complete' | 'failed'

export interface AgentLocation {
  city: string | null
  state: string | null
  country: string | null
  display: string | null
}

/**
 * One matched posting.
 *
 * Only `title`, `company`, `apply_url` and `score` are guaranteed. Everything
 * else is genuinely nullable and the guide is emphatic: null means the posting
 * did not state it, and we must not invent a value. `salary` and `deadline` in
 * particular are "rarely populated" — a wrong salary is a trust violation.
 */
export interface AgentOpportunity {
  title: string
  company: string
  apply_url: string
  score: number
  description?: string | null
  reasoning?: string | null
  location?: AgentLocation | null
  employment_type?: string | null
  work_mode?: string | null
  salary?: string | null
  /**
   * WARNING: this means "a salary was DISCLOSED", not "this role is paid".
   *
   * The agent computes it as `!!(salary.min || salary.max) || salaryDisclosedAsString`,
   * so a posting that simply never published its pay comes back `false` —
   * indistinguishable from one that stated it is unpaid. Measured on a real
   * run: all 7 returned matches were `false`, and none of them actually said
   * they were unpaid.
   *
   * So never render this as an "Unpaid" badge. Telling a student an internship
   * is unpaid when nobody established that is the same class of fabrication
   * that got nine ingestion providers deleted. Treat `false` as "not stated"
   * and show nothing, or read `salary` directly, which is null when absent.
   */
  is_paid?: boolean | null
  deadline?: string | null
  requirements?: string[] | null
  skills?: string[] | null
  missing_requirements?: string[] | null
  tier?: string | null
}

export interface AgentResult {
  status: 'ok' | 'partial' | 'weak_profile'
  result_tier: ResultTier
  opportunity_count: number
  opportunities: AgentOpportunity[]
  /** Written by the agent to be shown verbatim. Never substitute our own copy. */
  resume_feedback?: string | null
  resume_strength?: string | null
  weak_profile?: {
    returned?: number
    target?: number
    reasons?: string[]
    gaps?: { message?: string }[]
    gaps_note?: string
  } | null
}

export interface AgentJob {
  job_id?: string
  status: AgentStatus
  result?: AgentResult
  error?: { code: string; message: string }
}

export class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 502
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

/** Student-facing copy per error code. Switch on `code`, never on `message`. */
export const ERROR_COPY: Record<string, string> = {
  MISSING_FILE: 'No file was received. Please choose your resume and try again.',
  INVALID_FILE_TYPE:
    'That file is not a PDF. If you exported from Word, use “Save as PDF” rather than renaming the file.',
  FILE_TOO_LARGE: 'Your resume is over 5 MB. Please upload a smaller PDF.',
  JOB_NOT_FOUND: 'We could not find that search. Please start a new one.',
  PIPELINE_FAILED: 'The search did not finish. This is usually temporary — you can try again.',
  PIPELINE_TIMEOUT:
    'The search took too long and was stopped. Providers were likely busy; trying again later usually works.',
  AGENT_UNREACHABLE: 'The matching service is not responding right now. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
}

export function messageForCode(code: string | undefined): string {
  return (code && ERROR_COPY[code]) || ERROR_COPY.INTERNAL_ERROR
}

async function parseError(res: Response): Promise<AgentError> {
  let code = 'INTERNAL_ERROR'
  let message = `Agent responded ${res.status}`
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    if (body?.error?.code) code = body.error.code
    if (body?.error?.message) message = body.error.message
  } catch {
    /* non-JSON error body — keep the defaults */
  }
  return new AgentError(code, message, res.status)
}

/**
 * Submit a resume PDF. Returns the agent's job id.
 *
 * The agent validates the PDF by magic bytes, so a .docx renamed .pdf is
 * rejected there; we check the same signature first to fail fast and give a
 * clearer message.
 */
export async function submitResume(file: Blob, filename: string): Promise<string> {
  const form = new FormData()
  form.append('resume', file, filename)

  let res: Response
  try {
    res = await fetch(`${AGENT_BASE_URL}/api/jobs`, {
      method: 'POST',
      body: form,
      headers: agentAuthHeaders(),
      // Generous: this call only enqueues, but the service is single-threaded
      // and can be busy accepting.
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    throw new AgentError(
      'AGENT_UNREACHABLE',
      `Could not reach the matching service at ${AGENT_BASE_URL}: ${(e as Error).message}`,
      503
    )
  }

  if (!res.ok) throw await parseError(res)

  const body = (await res.json()) as { job_id?: string }
  if (!body.job_id) {
    throw new AgentError('INTERNAL_ERROR', 'Agent accepted the resume but returned no job_id')
  }
  return body.job_id
}

/** Fetch current job state. `processing` covers both queued and running. */
export async function fetchJob(agentJobId: string): Promise<AgentJob> {
  let res: Response
  try {
    res = await fetch(`${AGENT_BASE_URL}/api/jobs/${encodeURIComponent(agentJobId)}`, {
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
      headers: agentAuthHeaders(),
    })
  } catch (e) {
    throw new AgentError(
      'AGENT_UNREACHABLE',
      `Could not reach the matching service: ${(e as Error).message}`,
      503
    )
  }

  if (!res.ok) throw await parseError(res)
  return (await res.json()) as AgentJob
}

/** True when the first five bytes are the PDF signature. */
export async function looksLikePdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return String.fromCharCode(...head).startsWith('%PDF-')
}

/**
 * Copy for a tier.
 *
 * Branching on `result_tier` rather than `opportunity_count` is explicit
 * guidance: the count bands may be retuned, the tier names will not. A short
 * list is a correct outcome, so none of these read as an error.
 */
export function tierPresentation(tier: ResultTier, count: number): {
  headline: string
  tone: 'success' | 'info' | 'warning'
  feedbackProminence: 'hidden' | 'subtle' | 'prominent' | 'primary'
} {
  switch (tier) {
    case 'full':
      return { headline: `${count} strong matches for your resume`, tone: 'success', feedbackProminence: 'hidden' }
    case 'good':
      return { headline: `${count} good matches for your resume`, tone: 'success', feedbackProminence: 'subtle' }
    case 'limited':
      return { headline: `${count} matches found`, tone: 'info', feedbackProminence: 'prominent' }
    case 'very_limited':
      return { headline: count === 1 ? '1 match found' : `${count} matches found`, tone: 'warning', feedbackProminence: 'prominent' }
    case 'none':
    default:
      return { headline: 'No strong matches this time', tone: 'warning', feedbackProminence: 'primary' }
  }
}

/**
 * True when a shortfall was our pipeline's fault rather than the resume's.
 *
 * The guide is firm that these two cases look identical in a bare count and
 * must never be presented the same way — we must not imply a student's resume
 * was weak when our scoring failed.
 */
export function shortfallIsOurFault(result: AgentResult | null | undefined): boolean {
  if (!result) return false

  // A good outcome is never "our fault", however the pipeline got there.
  //
  // Matching the reason text alone was too eager: the agent reports every
  // provider hiccup it absorbs, so a run that discovered 26 postings, scored
  // them, and returned 7 good matches still carried "1 of 26 could not be
  // scored (provider errors)" — and the panel announced "Something went wrong
  // on our side" above its own text saying "Good match rate", then offered to
  // re-run a search that had just succeeded. Telling a student their
  // successful search failed is worse than saying nothing at all.
  //
  // The distinction the guide actually cares about is whether OUR failure is
  // why they got a thin result — so a tier that is already full or good rules
  // it out before the reasons are consulted.
  if (result.result_tier === 'full' || result.result_tier === 'good') return false

  const reasons = result.weak_profile?.reasons ?? []
  return reasons.some((r) => /could not be scored|provider error|on our side/i.test(r))
}
