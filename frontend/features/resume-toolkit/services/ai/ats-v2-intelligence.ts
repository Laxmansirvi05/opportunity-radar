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
import { getJdRequirements } from '@/lib/ats-checker/jd-requirements'

/** Caught values are `unknown`; surface a message without assuming an Error. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}


/**
 * These two functions normalise raw model JSON, so their input genuinely has
 * no guaranteed shape — which is why they were typed `any` throughout. Taking
 * `unknown` and reading through these helpers keeps the same runtime
 * behaviour (a property read on a loose record is identical) while stopping
 * callers from passing an unchecked value straight in. Zod still validates the
 * result at the end of each function; this only gets it there safely.
 */
type RawObject = Record<string, unknown>

function toRawObject(value: unknown): RawObject {
  return value && typeof value === 'object' ? (value as RawObject) : {}
}

/** The value when it is one of `allowed`, else `fallback`. */
function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}


export interface IntelligenceResult<T> {
  success: boolean
  data?: T
  error?: string
  provider?: string
}

export function normalizeStructuredJd(input: unknown): StructuredJD {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid StructuredJD object')
  }
  const parsed: RawObject = Array.isArray(input) ? { requirements: input } : (input as RawObject)

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
    parsed.requirements = rawReqs.map((rawReq: unknown, idx: number) => {
      const r = toRawObject(rawReq)
      const provenance = toRawObject(r.provenance)
      return {
      id: r.id || `req_${idx + 1}`,
      name: r.name || r.title || r.requirement || r.skill || null,
      category: pickEnum(
        r.category,
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
        ] as const,
        'technical_capability'
      ),
      importance: pickEnum(r.importance, ['critical', 'high', 'medium', 'low'] as const, 'medium'),
      description: r.description || null,
      provenance: {
        exactQuote: provenance.exactQuote || r.exactQuote || r.name || null,
        context: provenance.context || r.context || null,
      },
      }
    })
  } else {
    parsed.requirements = []
  }
  return structuredJDSchema.parse(parsed)
}

export function normalizeEvidenceMatrix(input: unknown): EvidenceMatrix {
  if (!input) {
    throw new Error('Invalid EvidenceMatrix object')
  }
  const parsed: RawObject = Array.isArray(input) ? { evaluations: input } : toRawObject(input)
  if (parsed.evaluations && Array.isArray(parsed.evaluations)) {
    parsed.evaluations = (parsed.evaluations as unknown[]).map((rawEval: unknown, idx: number) => {
      const e = toRawObject(rawEval)
      return {
      capabilityId: e.capabilityId || e.id || `req_${idx + 1}`,
      satisfaction: pickEnum(
        e.satisfaction,
        ['none', 'insufficient', 'partial', 'substantial', 'complete'] as const,
        'none'
      ),
      evidenceStrength: pickEnum(
        e.evidenceStrength,
        ['none', 'weak', 'moderate', 'strong', 'exceptional'] as const,
        'none'
      ),
      evidenceReferences: Array.isArray(e.evidenceReferences)
        ? (e.evidenceReferences as unknown[]).map((rawRef: unknown, refIdx: number) => {
            const ref = toRawObject(rawRef)
            return {
            evidenceId: ref.evidenceId || `ref_${refIdx + 1}`,
            sourceSection: ref.sourceSection || 'skills',
            exactText: ref.exactText || ref.snippet || 'Evidence text',
            evidenceType: pickEnum(
              ref.evidenceType,
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
              ] as const,
              'listed_skill'
            ),
            quantifiedImpact: ref.quantifiedImpact || null,
            recency: ref.recency || null,
            confidence: typeof ref.confidence === 'number' ? ref.confidence : 0.8,
            }
          })
        : [],
      confidence: typeof e.confidence === 'number' ? e.confidence : 0.8,
      semanticReasoning: e.semanticReasoning || e.reasoning || 'Evaluated requirement evidence.',
      gapReason: e.gapReason || null,
      uncertaintyReason: e.uncertaintyReason || null,
      }
    })
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
      const normalized = normalizeStructuredJd(parsed)
      const validReqs = normalized.requirements.filter(r => r.name && r.name.trim().length > 0)
      const jdLength = jobDescription ? jobDescription.trim().length : 0

      if (jdLength > 50 && validReqs.length === 0) {
        return { valid: false as const, reason: "JD contains content but zero requirements were extracted. Schema failure." }
      }

      // A zero-requirement check alone let a technically-non-empty but
      // badly under-extracted response (e.g. 1 requirement pulled from a
      // JD that plainly lists a dozen) pass validation and never retry
      // across the provider chain — this was the actual cause of "no
      // meaningful requirements" failures on JDs that clearly had plenty.
      // A substantial JD realistically has several distinct requirements;
      // scale the floor with length rather than hard-coding one JD's shape.
      //
      // The 900-char band originally topped out at a flat floor of 5 for
      // ANY longer JD, so a 2000+ char posting with a dozen genuine bullet
      // requirements could under-extract to exactly 5 and still pass —
      // confirmed live: the same JD scored 74 (5 requirements extracted,
      // several gaps) via the Optimiser and 92 (5 requirements, all matched)
      // via the ATS Checker in two independent extraction calls. Extending
      // the scale for long JDs forces a retry through the provider chain
      // instead of silently accepting a coarse, under-extracted structure.
      const minExpected = jdLength > 2000 ? 8 : jdLength > 1200 ? 6 : jdLength > 900 ? 5 : jdLength > 300 ? 3 : 1
      if (validReqs.length < minExpected) {
        return {
          valid: false as const,
          reason: `Under-extraction: only ${validReqs.length} requirement(s) found for a ${jdLength}-character job description (expected at least ${minExpected}). Schema failure.`,
        }
      }

      return { valid: true as const }
    } catch (e: unknown) {
      return { valid: false as const, reason: `Validation Error: ${errorMessage(e)}` }
    }
  }

  const aiResult = await callAI(
    {
      systemPrompt,
      userPrompt,
      maxTokens: 2500,
      // Matches evaluateResumeEvidence's 0.0 — extraction is a reading task,
      // not a creative one, and any temperature above 0 measurably widened
      // how many requirements the model chose to extract from the same JD
      // text run to run (see minExpected note above).
      temperature: 0.0,
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
    } catch (e: unknown) {
      return {
        success: false,
        error: `Failed to parse structured JD: ${errorMessage(e)}`,
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

  // One evaluation object — satisfaction, strength, evidence references with
  // their quoted text, reasoning — runs to roughly 200 output tokens, so a
  // flat 3500 silently truncated any job description with more than about a
  // dozen requirements. Observed live: a 32-requirement backend JD came back
  // with 14 evaluations (44% coverage), and because jsonrepair patches the
  // cut-off JSON the loss looked like a resume missing 19 skills rather than
  // a response that stopped early. Budget by the work actually asked for.
  const requirementCount = getJdRequirements(structuredJd).length
  const evidenceMaxTokens = Math.min(16000, Math.max(3500, 900 + requirementCount * 260))

  const validator = (responseContent: string) => {
    try {
      const repaired = jsonrepair(responseContent)
      const parsed = JSON.parse(repaired)
      normalizeEvidenceMatrix(parsed)
      return { valid: true as const }
    } catch (e: unknown) {
      return { valid: false as const, reason: `Validation Error: ${errorMessage(e)}` }
    }
  }

  const aiResult = await callAI(
    {
      systemPrompt,
      userPrompt,
      maxTokens: evidenceMaxTokens,
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
    } catch (e: unknown) {
      return {
        success: false,
        error: `Failed to parse evidence matrix: ${errorMessage(e)}`,
      }
    }
  }

  return {
    success: false,
    error: `AI provider sequence failed: ${aiResult.reason}`,
  }
}

