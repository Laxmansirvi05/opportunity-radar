import { jsonrepair } from 'jsonrepair'
import { callAI } from '@/lib/ai-gateway'
import { ParsedResumeSchema, type ParsedResume } from '@/types/resume'

/**
 * Direct PDF-text → ParsedResume extraction for the optimiser's upload path.
 *
 * Deliberately does NOT reuse /api/resume/parse's pipeline. That one asks the
 * model to produce the Resume Builder's full ResumeData shape — a deeply
 * nested schema (picture, metadata, layout, 12 section types) described only
 * in prose, never actually shown to the model as a schema. In practice that
 * produces inconsistent or badly truncated JSON (observed directly: a real
 * extraction attempt came back as just `{"id": "..."}`). ParsedResume is a
 * small flat schema, so this asks for it directly and validates the result
 * against it — a failure here is a real, visible error rather than an empty
 * resume silently flowing through as if it were real data.
 */

const SYSTEM_PROMPT = `You are a meticulous resume extraction engine. Convert the resume text into a JSON object.

HARD RULES (violating any of these makes the output wrong):
1. Extract ONLY what is explicitly written in the text. Never invent, guess, or infer a name, date, number, employer, institution, or skill that is not present.
2. Keep the candidate's own wording. Do not rewrite, summarise, or improve bullet points — copy them.
3. If a field is not present in the text, omit it (do not invent a placeholder).
4. Do not extract a photo or any image reference — there is none in the input.
5. Preserve the resume's own order for experience, projects and education (do not re-sort).

Return ONLY a JSON object with this exact shape, no markdown fences, no commentary:
{
  "name": string,
  "email": string (optional),
  "phone": string (optional),
  "linkedin": string (optional, full URL if present),
  "github": string (optional, full URL if present),
  "summary": string (optional — the professional summary / "about me" section, verbatim, copied AS-IS. Do not rewrite it, do not fold skills/experience/project details into it that belong in their own fields below, and do not pad it. If there is no dedicated summary section, omit this field rather than assembling one from other sections.),
  "skills": string[] (every explicit technical skill, tool, framework and programming language listed anywhere, including inside a "Technical Skills" section broken into subcategories, AND any technology named in a summary/about-me paragraph or inside experience/project bullets — flatten them all into one list. Do NOT include spoken/human languages like "English" or "Hindi" here — those are not technical skills.),
  "experience": [{
    "company": string,
    "role": string,
    "start_date": string (as written, e.g. "May 2026" or "2023"),
    "end_date": string (optional — omit if current/present),
    "location": string (optional),
    "bullets": string[] (each bullet point verbatim, one entry per bullet — do not merge them)
  }],
  "projects": [{
    "name": string,
    "description": string (optional, verbatim),
    "technologies": string[] (technologies mentioned for this specific project, if listed)
  }],
  "education": [{
    "institution": string,
    "degree": string,
    "degree_level": "doctorate"|"masters"|"bachelors"|"diploma"|"other",
    "field": string (optional),
    "graduation_year": number (optional, only if a real year is stated),
    "gpa": number (optional — omit this field entirely unless the resume states a value already on a 0-10 scale, e.g. "9.28/10" or "CGPA: 8.5". A percentage like "94.2%" is NOT a GPA — omit the field rather than converting it. Never write 0; 0 is not "unknown", it is a claim of the worst possible GPA.)
  }],
  "certifications": string[] (each certification's full title, verbatim, one per entry — do not merge with skills),
  "achievements": string[] (awards, competition results, quantified achievements like "solved 750+ coding problems" or "Top 5 finalist among 120+ teams" — verbatim, one per entry)
}`

function buildUserPrompt(rawText: string): string {
  return `Extract this resume into the JSON shape described. Resume text:\n\n${rawText.slice(0, 15000)}`
}

export interface ExtractResult {
  success: boolean
  resume?: ParsedResume
  error?: string
}

/**
 * A model that's told to omit an unavailable GPA will sometimes write 0
 * instead of leaving the field out — 0 is not "unknown", it's a claim of the
 * worst possible GPA, which is exactly the kind of fabricated number this
 * feature exists to prevent. Strip it rather than trust it.
 */
function stripZeroGpa(resume: ParsedResume): ParsedResume {
  return {
    ...resume,
    education: resume.education.map((edu) => (edu.gpa === 0 ? { ...edu, gpa: undefined } : edu)),
  }
}

function parseAndValidate(raw: string): ParsedResume | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(jsonrepair(cleaned))
    const result = ParsedResumeSchema.safeParse(parsed)
    return result.success ? stripZeroGpa(result.data) : null
  } catch {
    return null
  }
}

/**
 * `skills`/`experience`/`projects`/`education` all default to `[]`, so a
 * response that was cut off before the model ever wrote them (e.g. it burned
 * its token budget on a long `summary` first, per the field order above)
 * still parses as a perfectly valid, schema-passing ParsedResume — just an
 * empty one. Confirmed live: a real extraction on a real resume came back
 * with `summary` truncated mid-sentence and every field after it in JSON key
 * order silently empty, and the schema check alone accepted it. A resume
 * with substantial raw text and nothing extracted into any of these four
 * arrays is a real under-extraction, not a genuinely empty resume — force a
 * retry through the provider chain instead of accepting it.
 */
function isUnderExtracted(resume: ParsedResume, rawText: string): boolean {
  const hasStructuredContent =
    resume.skills.length > 0 ||
    resume.experience.length > 0 ||
    resume.projects.length > 0 ||
    resume.education.length > 0
  return !hasStructuredContent && rawText.trim().length > 400
}

export async function extractResumeFromText(rawText: string, userId: string): Promise<ExtractResult> {
  const validator = (content: string) => {
    const resume = parseAndValidate(content)
    if (!resume) return { valid: false as const, reason: 'Output did not match the resume schema.' }
    if (isUnderExtracted(resume, rawText)) {
      return { valid: false as const, reason: 'Schema passed but skills, experience, projects and education all came back empty for a substantial resume — likely truncated output.' }
    }
    return { valid: true as const }
  }

  const ai = await callAI(
    { systemPrompt: SYSTEM_PROMPT, userPrompt: buildUserPrompt(rawText), outputFormat: 'json', maxTokens: 6000, temperature: 0.1 },
    { feature: 'resume_extraction', userId, validator }
  )

  if (!ai.success) {
    return { success: false, error: `Could not read this resume (${ai.reason}). Please try again or upload a different file.` }
  }

  const resume = parseAndValidate(ai.content)
  if (!resume) {
    return { success: false, error: 'Could not read this resume clearly. Please try a text-based PDF rather than a scanned image.' }
  }

  return { success: true, resume }
}
