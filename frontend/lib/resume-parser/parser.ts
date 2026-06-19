import { callAI }              from '@/lib/ai-gateway'
import { extractTextFromPDF, validatePDFBuffer } from './pdf-extractor'
import { RESUME_PARSE_SYSTEM_PROMPT, validateParsedResume } from './schema'
import { extractResumeSkills } from '@/types/resume'
import type { ParsedResume }   from '@/types/resume'
import type { AIResult }       from '@/types/ai'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
export interface ParseSuccess {
  success: true
  parsed:  ParsedResume
  extractedSkills:          string[]
  extractedProjectKeywords: string[]
  provider: string
  latencyMs: number
}

export interface ParseFailure {
  success: false
  error:   string
  stage:   'validation' | 'extraction' | 'ai' | 'parsing'
}

export type ParseResult = ParseSuccess | ParseFailure

// ---------------------------------------------------------------------------
// Main parse pipeline
// ---------------------------------------------------------------------------
export async function parseResume(
  buffer: ArrayBuffer,
  userId: string
): Promise<ParseResult> {
  // Stage 1: Validate the PDF buffer
  const validation = validatePDFBuffer(buffer)
  if (!validation.valid) {
    return { success: false, error: validation.error!, stage: 'validation' }
  }

  // Stage 2: Extract text from PDF
  let rawText: string
  try {
    rawText = await extractTextFromPDF(buffer)
  } catch (err) {
    return {
      success: false,
      error:   'Failed to extract text from PDF. The file may be corrupted or image-based.',
      stage:   'extraction',
    }
  }

  if (rawText.trim().length < 50) {
    return {
      success: false,
      error:   'Could not extract enough text from the PDF. Try a text-based PDF.',
      stage:   'extraction',
    }
  }

  // Stage 3: Call AI Gateway (Gemini Flash → Groq fallback)
  const aiResult: AIResult = await callAI(
    {
      systemPrompt: RESUME_PARSE_SYSTEM_PROMPT,
      userPrompt:   `Parse this resume:\n\n${rawText.slice(0, 8000)}`,  // Trim to avoid token limits
      maxTokens:    2000,
      temperature:  0.1,  // Very low — we want consistent structured extraction
      outputFormat: 'json',
    },
    { feature: 'resume_parser', userId }
  )

  if (!aiResult.success) {
    return {
      success: false,
      error:   `AI parsing failed: ${aiResult.reason}. Please try again.`,
      stage:   'ai',
    }
  }

  // Stage 4: Validate the AI response against the Zod schema
  const parsed = validateParsedResume(aiResult.content)
  if (!parsed.success) {
    return {
      success: false,
      error:   `Resume data validation failed: ${parsed.error}`,
      stage:   'parsing',
    }
  }

  // Stage 5: Compute denormalised skill arrays
  const { skills, projectKeywords } = extractResumeSkills(parsed.data)

  return {
    success:                  true,
    parsed:                   parsed.data,
    extractedSkills:          skills,
    extractedProjectKeywords: projectKeywords,
    provider:                 aiResult.provider,
    latencyMs:                aiResult.latencyMs,
  }
}
