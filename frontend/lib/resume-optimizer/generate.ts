import { callAI } from '@/lib/ai-gateway'
import type { AIFeature } from '@/types/ai'
import { ParsedResumeSchema, type ParsedResume } from '@/types/resume'
import { jsonrepair } from 'jsonrepair'
import { verifyNoFabrication, describeFindings, type FabricationVerdict } from './fabrication-guard'
import type { Suggestion } from './tiers'

/**
 * Resume generation.
 *
 * Two rules shape everything here:
 *
 * 1. The model rewrites, it does not invent. Output is checked by the
 *    fabrication guard and rejected if it added facts, so the prompt is written
 *    to avoid a failure the guard would catch anyway.
 * 2. The result must not read as machine-written. A recruiter who senses AI
 *    discounts the whole document, so the prompt bans the vocabulary and rhythm
 *    that give it away.
 */

/**
 * Words that mark a resume as AI-written.
 *
 * These are not bad words in isolation; they are the words models reach for
 * unprompted, and their density is the tell. Students rarely write "spearheaded
 * a robust, seamless solution" unaided.
 */
export const AI_TELL_WORDS = [
  'spearheaded', 'leveraged', 'leveraging', 'orchestrated', 'utilized', 'utilised',
  'delved', 'showcasing', 'showcase', 'robust', 'seamless', 'seamlessly',
  'cutting-edge', 'state-of-the-art', 'passionate', 'meticulous', 'meticulously',
  'synergy', 'synergies', 'holistic', 'paradigm', 'tapestry', 'realm',
  'game-changer', 'revolutionize', 'revolutionise', 'elevate', 'unlock',
  'streamlined', 'spearheading', 'pivotal', 'instrumental',
]

/** Shared writing rules, applied to both generated resumes. */
const WRITING_RULES = `
WRITING RULES — a recruiter must not be able to tell this was machine-written.

Vocabulary:
- Never use any of these: ${AI_TELL_WORDS.join(', ')}.
- Prefer the plain verb a person would use: built, wrote, shipped, fixed, tested,
  designed, migrated, automated, analysed, presented, led, taught.
- No adjectives praising the work itself. "Built the payment flow", never
  "successfully built a comprehensive payment flow".

Rhythm:
- Vary bullet length deliberately. Some 8 words, some 20. Uniform bullets are the
  clearest sign of generated text.
- Vary how bullets open. Do not start every line with a past-tense verb.
- No em-dashes. Use a comma or full stop.
- One idea per bullet.

Substance:
- Keep the candidate's own words wherever they already work. You are editing,
  not replacing a voice.
- Never invent a number, percentage, duration, team size or outcome. If the
  source says "improved load time", it stays qualitative.
- Do not pad. Fewer strong bullets beat more weak ones.
`.trim()

const OUTPUT_CONTRACT = `
Return ONLY a JSON object matching this shape, with no prose or code fences:

{
  "name": string,
  "email": string (optional),
  "phone": string (optional),
  "linkedin": string (optional),
  "github": string (optional),
  "summary": string (optional, 2 sentences maximum),
  "skills": string[],
  "experience": [{ "company": string, "role": string, "start_date": string,
                   "end_date": string (optional), "location": string (optional),
                   "bullets": string[] }],
  "projects": [{ "name": string, "description": string (optional),
                 "technologies": string[], "url": string (optional) }],
  "education": [{ "institution": string, "degree": string,
                  "degree_level": "doctorate"|"masters"|"bachelors"|"diploma"|"other",
                  "field": string (optional), "graduation_year": number (optional),
                  "gpa": number (optional) }],
  "certifications": string[] (optional — carry every certification from the source resume over verbatim; see CONFIRMED ADDITIONS for the only permitted new entries),
  "achievements": string[] (optional — carry every achievement from the source resume over verbatim, unchanged)
}
`.trim()

export function buildPolishPrompt(
  resume: ParsedResume,
  jobDescription: string,
  role: string,
  company: string
) {
  const systemPrompt = `You are an experienced technical recruiter who rewrites student resumes so they read well and parse cleanly through applicant tracking systems.

You are rewriting ONE resume. Every fact must survive unchanged.

ABSOLUTE CONSTRAINTS — output is automatically rejected if broken:
- Do not add an employer, institution, qualification or date that is not in the source.
- Do not add any number that is not in the source.
- Do not add a project, skill, certification or achievement that is not in the source.
- Carry every certification and achievement from the source over unchanged — never drop them, even when you cannot improve their wording.
- You may reorder, reword, merge and cut. You may not add facts.

Your job is presentation only: sharper wording, clearer structure, terminology
matching the target role where the candidate genuinely has the experience.

${WRITING_RULES}

${OUTPUT_CONTRACT}`

  const userPrompt = `TARGET ROLE: ${role} at ${company}

JOB DESCRIPTION (for vocabulary alignment only — do not import claims from it):
${jobDescription.slice(0, 4000)}

CANDIDATE'S RESUME (the only permitted source of fact):
${JSON.stringify(resume, null, 2)}

Rewrite this resume. Same facts, better presentation.`

  return { systemPrompt, userPrompt }
}

export function buildTargetPrompt(
  resume: ParsedResume,
  jobDescription: string,
  role: string,
  company: string,
  completed: Suggestion[]
) {
  const additions = completed
    .map((s) => `- ${s.type.toUpperCase()}: ${s.requirement} — ${s.title}`)
    .join('\n')

  const systemPrompt = `You are an experienced technical recruiter rewriting a student's resume for a specific role.

The candidate has since completed the work listed under CONFIRMED ADDITIONS. They
have told us each item is genuinely done, so you may present those as real,
alongside everything already on the resume.

ABSOLUTE CONSTRAINTS — output is automatically rejected if broken:
- Do not add an employer, institution, qualification or date that is not in the source.
- Do not add any number that is not in the source. This applies to the new work too:
  describe what was built, never how many users it served.
- The ONLY additions permitted are the confirmed items listed below.
- Everything already on the resume stays factually unchanged — this includes
  certifications and achievements: carry every one of them over verbatim, never drop them.

For each confirmed item, write it the way the candidate would: a short, concrete
project entry or a skill listed among their skills. Do not inflate it into a
professional engagement.

${WRITING_RULES}

${OUTPUT_CONTRACT}`

  const userPrompt = `TARGET ROLE: ${role} at ${company}

JOB DESCRIPTION:
${jobDescription.slice(0, 4000)}

CANDIDATE'S RESUME:
${JSON.stringify(resume, null, 2)}

CONFIRMED ADDITIONS (the candidate has completed these):
${additions || '(none)'}

Rewrite the resume for this role, incorporating the confirmed additions.`

  return { systemPrompt, userPrompt }
}

// ── Generation ──────────────────────────────────────────────────────────────

export interface GenerationResult {
  success: boolean
  resume?: ParsedResume
  error?: string
  /** Present when the guard rejected output; useful for logs, not for students. */
  fabrication?: FabricationVerdict
}

function parseResume(raw: string): ParsedResume | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    return ParsedResumeSchema.parse(JSON.parse(jsonrepair(cleaned)))
  } catch {
    return null
  }
}

/**
 * Generate and verify, retrying once with the guard's findings as feedback.
 *
 * A single retry is deliberate. If the model fabricates twice while being told
 * exactly what it invented, the honest outcome is failure — not a third attempt,
 * and certainly not shipping the output anyway.
 */
async function generateVerified(
  prompts: { systemPrompt: string; userPrompt: string },
  source: ParsedResume,
  allowed: { projects?: string[]; skills?: string[]; certifications?: string[] },
  feature: AIFeature,
  userId: string
): Promise<GenerationResult> {
  let lastVerdict: FabricationVerdict | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt =
      attempt === 0
        ? prompts.userPrompt
        : `${prompts.userPrompt}

YOUR PREVIOUS ATTEMPT WAS REJECTED. It introduced content that is not in the
source resume and was not confirmed by the candidate:
${lastVerdict?.findings.map((f) => `- ${f.detail}: "${f.value}"`).join('\n')}

Produce the resume again without any of that. Remove the invented content
entirely rather than rephrasing it.`

    const ai = await callAI(
      { systemPrompt: prompts.systemPrompt, userPrompt, outputFormat: 'json', maxTokens: 4000, temperature: 0.4 },
      { feature, userId }
    )

    if (!ai.success) {
      return { success: false, error: `The AI service was unavailable (${ai.reason}). Please try again.` }
    }

    const resume = parseResume(ai.content)
    if (!resume) {
      if (attempt === 1) return { success: false, error: 'The AI returned a resume we could not read. Please try again.' }
      continue
    }

    const verdict = verifyNoFabrication(source, resume, allowed)
    if (verdict.clean) return { success: true, resume }

    lastVerdict = verdict
    console.warn(`[Optimizer] attempt ${attempt + 1} rejected — ${describeFindings(verdict)}`)
  }

  return {
    success: false,
    error:
      'We could not generate a version we were confident was accurate, so we have not produced one. Nothing was changed on your resume.',
    fabrication: lastVerdict,
  }
}

export async function generatePolishedResume(
  source: ParsedResume,
  jobDescription: string,
  role: string,
  company: string,
  userId: string
): Promise<GenerationResult> {
  return generateVerified(
    buildPolishPrompt(source, jobDescription, role, company),
    source,
    {}, // nothing new may be added at all
    'resume_polish',
    userId
  )
}

export async function generateTargetResume(
  source: ParsedResume,
  jobDescription: string,
  role: string,
  company: string,
  completed: Suggestion[],
  userId: string
): Promise<GenerationResult> {
  const allowed = {
    projects: completed.filter((s) => s.type === 'project').map((s) => s.requirement),
    skills: completed.filter((s) => s.type === 'skill' || s.type === 'course').map((s) => s.requirement),
    certifications: completed.filter((s) => s.type === 'certification').map((s) => s.requirement),
  }

  return generateVerified(
    buildTargetPrompt(source, jobDescription, role, company, completed),
    source,
    allowed,
    'resume_target',
    userId
  )
}

/**
 * Count AI-tell words in a generated resume.
 *
 * Not a gate — a single "streamlined" is not worth failing a generation over —
 * but it is logged so prompt drift shows up before students notice it.
 */
export function countAiTells(resume: ParsedResume): { count: number; words: string[] } {
  const text = [
    resume.summary ?? '',
    ...(resume.experience ?? []).flatMap((e) => e.bullets ?? []),
    ...(resume.projects ?? []).map((p) => p.description ?? ''),
  ].join(' ').toLowerCase()

  const hits = AI_TELL_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(text))
  return { count: hits.length, words: hits }
}
