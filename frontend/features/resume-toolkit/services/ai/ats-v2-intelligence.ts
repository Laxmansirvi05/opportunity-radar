import { callAI } from '@/lib/ai-gateway'
import { jsonrepair } from 'jsonrepair'
import type { ParsedResume } from '@/types/resume'
import {
  structuredJDSchema,
  evidenceMatrixSchema,
  type StructuredJD,
  type EvidenceMatrix,
} from '../../lib/schema/resume/ats-v2'
import { buildJDExtractionPrompt, buildATSv2EvidenceMatrixPrompt } from './ats-v2-prompts'
import { sanitizeEvidenceMatrix } from './ats-v2-hallucination-guard'

export interface IntelligenceResult<T> {
  success: boolean
  data?: T
  error?: string
  provider?: string
}

export async function extractJDIntelligence(
  jobDescription: string,
  companyName?: string,
  targetRole?: string,
  userId?: string
): Promise<IntelligenceResult<StructuredJD>> {
  const { systemPrompt, userPrompt } = buildJDExtractionPrompt(jobDescription, companyName, targetRole)

  const validator = (responseContent: string) => {
    try {
      const repaired = jsonrepair(responseContent)
      const parsed = JSON.parse(repaired)
      const res = structuredJDSchema.safeParse(parsed)
      if (res.success) {
        return { valid: true as const }
      }
      return { valid: false as const, reason: `Zod Validation Error: ${res.error.message}` }
    } catch (e: any) {
      return { valid: false as const, reason: `JSON Parse Error: ${e.message}` }
    }
  }

  const aiResult = await callAI(
    {
      systemPrompt,
      userPrompt,
      maxTokens: 2500,
      temperature: 0.1,
      outputFormat: 'json',
    },
    {
      feature: 'jd_intelligence',
      userId,
      validator,
    }
  )

  if (aiResult.success) {
    try {
      const repaired = jsonrepair(aiResult.content)
      const parsed = JSON.parse(repaired)
      const structuredJd = structuredJDSchema.parse(parsed)
      return {
        success: true,
        data: structuredJd,
        provider: aiResult.provider,
      }
    } catch (e: any) {
      return {
        success: false,
        error: `Failed to parse structured JD: ${e.message}`,
      }
    }
  }

  return {
    success: false,
    error: `AI provider sequence failed: ${aiResult.reason}`,
  }
}

export async function evaluateResumeEvidence(
  resume: ParsedResume,
  structuredJd: StructuredJD,
  userId?: string
): Promise<IntelligenceResult<EvidenceMatrix>> {
  const { systemPrompt, userPrompt } = buildATSv2EvidenceMatrixPrompt(resume, structuredJd)

  const validator = (responseContent: string) => {
    try {
      const repaired = jsonrepair(responseContent)
      let parsed = JSON.parse(repaired)
      if (Array.isArray(parsed)) {
        parsed = { evaluations: parsed }
      }
      const res = evidenceMatrixSchema.safeParse(parsed)
      if (res.success) {
        return { valid: true as const }
      }
      return { valid: false as const, reason: `Zod Validation Error: ${res.error.message}` }
    } catch (e: any) {
      return { valid: false as const, reason: `JSON Parse Error: ${e.message}` }
    }
  }

  const aiResult = await callAI(
    {
      systemPrompt,
      userPrompt,
      maxTokens: 3500,
      temperature: 0.2,
      outputFormat: 'json',
    },
    {
      feature: 'evidence_evaluation',
      userId,
      validator,
    }
  )

  if (aiResult.success) {
    try {
      const repaired = jsonrepair(aiResult.content)
      let parsed = JSON.parse(repaired)
      if (Array.isArray(parsed)) {
        parsed = { evaluations: parsed }
      }
      const rawMatrix = evidenceMatrixSchema.parse(parsed)

      // Run hallucination guard
      const { sanitizedMatrix } = sanitizeEvidenceMatrix(resume, rawMatrix)

      return {
        success: true,
        data: sanitizedMatrix,
        provider: aiResult.provider,
      }
    } catch (e: any) {
      return {
        success: false,
        error: `Failed to parse evidence matrix: ${e.message}`,
      }
    }
  }

  return {
    success: false,
    error: `AI provider sequence failed: ${aiResult.reason}`,
  }
}
