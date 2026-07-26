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

export function normalizeStructuredJd(parsed: any): StructuredJD {
  if (Array.isArray(parsed)) {
    parsed = { requirements: parsed }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid StructuredJD object')
  }

  if (!parsed.roleTitle) {
    parsed.roleTitle = parsed.title || parsed.role || 'Target Role'
  }
  if (!parsed.companyName) {
    parsed.companyName = parsed.company || null
  }
  if (!parsed.hardRequirements || !Array.isArray(parsed.hardRequirements)) {
    parsed.hardRequirements = []
  }
  if (!parsed.technicalCapabilities || !Array.isArray(parsed.technicalCapabilities)) {
    parsed.technicalCapabilities = []
  }
  if (!parsed.responsibilities || !Array.isArray(parsed.responsibilities)) {
    parsed.responsibilities = []
  }

  const rawReqs = parsed.requirements || parsed.capabilities || parsed.reqs || parsed.jobRequirements || []
  if (Array.isArray(rawReqs)) {
    parsed.requirements = rawReqs.map((r: any, idx: number) => ({
      id: r.id || `req_${idx + 1}`,
      name: r.name || r.title || r.requirement || `Requirement ${idx + 1}`,
      category:
        r.category &&
        [
          'hard_requirement',
          'technical_capability',
          'responsibility',
          'experience_level',
          'education',
          'certification',
          'domain_knowledge',
          'tooling_environment',
          'soft_skill',
          'location_auth',
          'preferred_qualification',
          'other',
        ].includes(r.category)
          ? r.category
          : 'technical_capability',
      importance:
        r.importance && ['critical', 'high', 'medium', 'low'].includes(r.importance)
          ? r.importance
          : 'medium',
      description: r.description || null,
      provenance: {
        exactQuote: r.provenance?.exactQuote || r.exactQuote || r.name || null,
        context: r.provenance?.context || r.context || null,
      },
    }))
  } else {
    parsed.requirements = []
  }
  return structuredJDSchema.parse(parsed)
}

export function normalizeEvidenceMatrix(parsed: any): EvidenceMatrix {
  if (!parsed) {
    throw new Error('Invalid EvidenceMatrix object')
  }
  if (Array.isArray(parsed)) {
    parsed = { evaluations: parsed }
  }
  if (parsed.evaluations && Array.isArray(parsed.evaluations)) {
    parsed.evaluations = parsed.evaluations.map((e: any, idx: number) => ({
      capabilityId: e.capabilityId || e.id || `req_${idx + 1}`,
      satisfaction:
        e.satisfaction &&
        ['none', 'insufficient', 'partial', 'substantial', 'complete'].includes(e.satisfaction)
          ? e.satisfaction
          : 'none',
      evidenceStrength:
        e.evidenceStrength &&
        ['none', 'weak', 'moderate', 'strong', 'exceptional'].includes(e.evidenceStrength)
          ? e.evidenceStrength
          : 'none',
      evidenceReferences: Array.isArray(e.evidenceReferences)
        ? e.evidenceReferences.map((ref: any, refIdx: number) => ({
            evidenceId: ref.evidenceId || `ref_${refIdx + 1}`,
            sourceSection: ref.sourceSection || 'skills',
            exactText: ref.exactText || ref.snippet || 'Evidence text',
            evidenceType:
              ref.evidenceType &&
              [
                'learning',
                'listed_skill',
                'coursework',
                'certification',
                'education',
                'project',
                'professional_experience',
                'achievement',
                'leadership',
              ].includes(ref.evidenceType)
                ? ref.evidenceType
                : 'listed_skill',
            quantifiedImpact: ref.quantifiedImpact || null,
            recency: ref.recency || null,
            confidence: typeof ref.confidence === 'number' ? ref.confidence : 0.8,
          }))
        : [],
      confidence: typeof e.confidence === 'number' ? e.confidence : 0.8,
      semanticReasoning: e.semanticReasoning || e.reasoning || 'Evaluated requirement evidence.',
      gapReason: e.gapReason || null,
      uncertaintyReason: e.uncertaintyReason || null,
    }))
  }
  return evidenceMatrixSchema.parse(parsed)
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
      normalizeStructuredJd(parsed)
      return { valid: true as const }
    } catch (e: any) {
      return { valid: false as const, reason: `Validation Error: ${e.message}` }
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
      const structuredJd = normalizeStructuredJd(parsed)
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
      const parsed = JSON.parse(repaired)
      normalizeEvidenceMatrix(parsed)
      return { valid: true as const }
    } catch (e: any) {
      return { valid: false as const, reason: `Validation Error: ${e.message}` }
    }
  }

  const aiResult = await callAI(
    {
      systemPrompt,
      userPrompt,
      maxTokens: 3500,
      temperature: 0.0,
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
      const parsed = JSON.parse(repaired)
      const rawMatrix = normalizeEvidenceMatrix(parsed)

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

