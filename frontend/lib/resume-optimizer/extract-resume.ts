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
  "summary": string (optional — the professional summary / "about me" section, verbatim),
  "skills": string[] (every explicit technical skill, tool, framework and programming language listed anywhere, including inside a "Technical Skills" section broken into subcategories — flatten them all into one list. Do NOT include spoken/human languages like "English" or "Hindi" here — those are not technical skills.),
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

export async function extractResumeFromText(rawText: string, userId: string): Promise<ExtractResult> {
  const validator = (content: string) => {
    const resume = parseAndValidate(content)
    if (!resume) return { valid: false as const, reason: 'Output did not match the resume schema.' }
    return { valid: true as const }
  }

  const ai = await callAI(
    { systemPrompt: SYSTEM_PROMPT, userPrompt: buildUserPrompt(rawText), outputFormat: 'json', maxTokens: 4000, temperature: 0.1 },
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
