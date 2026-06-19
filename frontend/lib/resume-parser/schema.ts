import { z } from 'zod'
import { ParsedResumeSchema, type ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// Gemini system prompt for resume parsing
// ---------------------------------------------------------------------------
export const RESUME_PARSE_SYSTEM_PROMPT = `You are an expert resume parser.

TASK:
Extract structured data from the resume text provided.

STRICT RULES:
1. Only extract information that is explicitly present in the text.
2. Do NOT infer, assume, or fabricate any information.
3. Normalise all skill names to lowercase (e.g. "Python" → "python").
4. For degree_level, map to: "doctorate" | "masters" | "bachelors" | "diploma" | "other".
5. If a field is not present in the text, omit it or return an empty array.
6. Output ONLY valid JSON matching the schema below. No commentary, no markdown.

OUTPUT SCHEMA:
{
  "name": "string",
  "email": "string (optional)",
  "phone": "string (optional)",
  "linkedin": "string URL (optional)",
  "github": "string URL (optional)",
  "summary": "string (optional)",
  "skills": ["string", ...],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "start_date": "string",
      "end_date": "string (optional, omit if current)",
      "location": "string (optional)",
      "bullets": ["string", ...]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string (optional)",
      "technologies": ["string", ...],
      "url": "string URL (optional)"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "degree_level": "bachelors | masters | doctorate | diploma | other",
      "field": "string (optional)",
      "graduation_year": number (optional),
      "gpa": number (optional)
    }
  ]
}`

// ---------------------------------------------------------------------------
// Zod schema for AI response validation
// ---------------------------------------------------------------------------
export const ResumeParseResponseSchema = ParsedResumeSchema

export type ResumeParseResponse = ParsedResume

// ---------------------------------------------------------------------------
// Validate and parse AI JSON output
// ---------------------------------------------------------------------------
export function validateParsedResume(
  raw: string
): { success: true; data: ParsedResume } | { success: false; error: string } {
  try {
    const json = JSON.parse(raw.trim())
    const result = ResumeParseResponseSchema.safeParse(json)

    if (!result.success) {
      return {
        success: false,
        error:   result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }
    }

    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'AI response was not valid JSON' }
  }
}
