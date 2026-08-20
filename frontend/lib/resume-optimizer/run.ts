import { extractJDIntelligence, evaluateResumeEvidence } from '@/features/resume-toolkit/services/ai/ats-v2-intelligence'
import { calculateAtsV2Score } from '@/lib/ats-checker/scoring-v2'
import { findRecentAtsV2Evaluation, scoreFromCachedEvaluation } from './shared-evaluation'
import type { AtsV2Score } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import type { ParsedResume } from '@/types/resume'
import { decideTier, tierPlan, deriveSuggestions, suggestionCountForScore, type OptimizationTier, type Suggestion } from './tiers'
import { generatePolishedResume, generateTargetResume } from './generate'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Orchestrates a full optimisation run.
 *
 * Every score here comes from calculateAtsV2Score, including scores for the
 * AI's own generated output — never from the model's claim about how good its
 * work is. A generated resume that cannot be scored is not shown, because an
 * unscored resume presented as scored would be exactly the kind of fabricated
 * number this feature exists to avoid.
 */

export interface StartRunInput {
  resume: ParsedResume
  jobDescription: string
  targetRole: string
  companyName: string
  userId: string
  /** Supabase client + the resume's identity, used to reuse a matching
   *  evaluation from either feature instead of re-running the AI — see
   *  shared-evaluation.ts. Optional so existing callers (and tests) that
   *  don't pass them simply always run a fresh evaluation. */
  supabase?: SupabaseClient
  resumeId?: string | null
  resumeUpdatedAt?: string | null
}

export interface StartRunResult {
  structuredJd: StructuredJD
  baselineEvidenceMatrix: EvidenceMatrix
  baselineScore: number
  baselineReport: AtsV2Score
  tier: OptimizationTier
  suggestions: Suggestion[]
  polishedResume?: ParsedResume
  polishedScore?: number
  polishedReport?: AtsV2Score
  targetResume?: ParsedResume
  targetScore?: number
  targetReport?: AtsV2Score
  /** Non-fatal: the run still has a real baseline score even if generation failed. */
  warning?: string
}

export type StartRunOutcome =
  | { success: true; result: StartRunResult }
  | { success: false; error: string }

export async function startOptimizationRun(input: StartRunInput): Promise<StartRunOutcome> {
  // Reuse a matching evaluation the ATS Checker (or an earlier Optimiser run)
  // already computed for this exact resume + job description, so the two
  // features never land on two different scores for what is, to the
  // student, the same question asked twice.
  const cached = input.supabase
    ? await findRecentAtsV2Evaluation(
        input.supabase,
        input.userId,
        input.resumeId ?? null,
        input.jobDescription,
        input.resumeUpdatedAt ?? null
      )
    : null

  let structuredJd: StructuredJD
  let evidenceMatrix: EvidenceMatrix

  if (cached) {
    structuredJd = cached.structuredJd
    evidenceMatrix = cached.evidenceMatrix
  } else {
    const jdRes = await extractJDIntelligence(input.jobDescription, input.companyName, input.targetRole, input.userId)
    if (!jdRes.success || !jdRes.data) {
      return { success: false, error: jdRes.error || 'Could not analyse the job description. Please try again.' }
    }

    const evalRes = await evaluateResumeEvidence(input.resume, jdRes.data, input.userId)
    if (!evalRes.success || !evalRes.data) {
      return { success: false, error: evalRes.error || 'Could not evaluate your resume against this role. Please try again.' }
    }

    structuredJd = jdRes.data
    evidenceMatrix = evalRes.data
  }

  const baselineReport = cached
    ? scoreFromCachedEvaluation(cached, input.resume)
    : calculateAtsV2Score(structuredJd, evidenceMatrix, input.resume)
  const baselineScore = Math.round(baselineReport.overallScore)
  const tier = decideTier(baselineScore)
  const plan = tierPlan(tier)
  const suggestions = plan.generatesSuggestions
    ? deriveSuggestions(structuredJd, evidenceMatrix, {
        maxProjects: suggestionCountForScore(baselineScore),
        maxOther: suggestionCountForScore(baselineScore),
      })
    : []

  const result: StartRunResult = {
    structuredJd,
    baselineEvidenceMatrix: evidenceMatrix,
    baselineScore,
    baselineReport,
    tier,
    suggestions,
  }

  // Tier 90+ ("already strong") generates nothing — telling a strong resume
  // it is weak to justify output would be dishonest, per plan.generatesPolished.
  if (plan.generatesPolished) {
    const gen = await generatePolishedResume(input.resume, input.jobDescription, input.targetRole, input.companyName, input.userId)
    if (gen.success && gen.resume) {
      const polishedEval = await evaluateResumeEvidence(gen.resume, structuredJd, input.userId)
      if (polishedEval.success && polishedEval.data) {
        const polishedReport = calculateAtsV2Score(structuredJd, polishedEval.data, gen.resume)
        result.polishedResume = gen.resume
        result.polishedReport = polishedReport
        result.polishedScore = Math.round(polishedReport.overallScore)
      } else {
        result.warning = 'A polished resume was generated but could not be scored, so it is not shown. Your baseline score above is still accurate.'
      }
    } else {
      result.warning = gen.error || 'Could not generate a polished resume. Your baseline score above is still accurate.'
    }
  }

  // A full-tier run with zero suggestions (every requirement already
  // evidenced) is unlocked from the moment it's created — targetResumeUnlocked
  // treats an empty checklist as satisfied. There is then no checklist for the
  // student to ever confirm, so Resume B has to be generated here or it would
  // simply never exist.
  if (plan.generatesTarget && suggestions.length === 0) {
    const targetOutcome = await runTargetGeneration({
      resume: input.resume,
      jobDescription: input.jobDescription,
      targetRole: input.targetRole,
      companyName: input.companyName,
      structuredJd,
      completedSuggestions: [],
      userId: input.userId,
    })
    if (targetOutcome.success) {
      result.targetResume = targetOutcome.resume
      result.targetScore = targetOutcome.score
      result.targetReport = targetOutcome.report
    } else if (!result.warning) {
      result.warning = targetOutcome.error
    }
  }

  return { success: true, result }
}

export interface TargetRunInput {
  resume: ParsedResume
  jobDescription: string
  targetRole: string
  companyName: string
  /** Reused from the original run when available, to score against the exact
   *  requirement set the suggestions were derived from. Re-extracted from the
   *  stored job description when not (e.g. it was not persisted). */
  structuredJd?: StructuredJD
  completedSuggestions: Suggestion[]
  userId: string
  /** A resume already generated by a prior attempt that failed at the
   *  scoring step (see the `partialResume` note below). When present,
   *  generation is skipped and this run goes straight to evaluation. */
  existingResume?: ParsedResume
}

export type TargetRunOutcome =
  | { success: true; resume: ParsedResume; score: number; report: AtsV2Score }
  // `partialResume` is set only when generation itself succeeded and the
  // failure was in scoring — the caller can persist it so a retry does not
  // pay for the ~20-45s generation call a second time. Confirmed live: a
  // resume that generated cleanly then failed evidence evaluation forced 4
  // full regenerate-and-rescore cycles before both steps landed in the same
  // attempt, each one re-doing work that had already succeeded.
  | { success: false; error: string; partialResume?: ParsedResume }

/** Generates Resume B once the suggestion checklist is fully confirmed. */
export async function runTargetGeneration(input: TargetRunInput): Promise<TargetRunOutcome> {
  let structuredJd = input.structuredJd
  if (!structuredJd) {
    const jdRes = await extractJDIntelligence(input.jobDescription, input.companyName, input.targetRole, input.userId)
    if (!jdRes.success || !jdRes.data) {
      return { success: false, error: jdRes.error || 'Could not analyse the job description. Please try again.' }
    }
    structuredJd = jdRes.data
  }

  let targetResume = input.existingResume
  if (!targetResume) {
    const gen = await generateTargetResume(
      input.resume,
      input.jobDescription,
      input.targetRole,
      input.companyName,
      input.completedSuggestions,
      input.userId
    )
    if (!gen.success || !gen.resume) {
      return { success: false, error: gen.error || 'Could not generate the target resume. Please try again.' }
    }
    targetResume = gen.resume
  }

  const evalRes = await evaluateResumeEvidence(targetResume, structuredJd, input.userId)
  if (!evalRes.success || !evalRes.data) {
    return {
      success: false,
      error: 'A target resume was generated but could not be scored yet. Retrying will only re-run scoring, not generation.',
      partialResume: targetResume,
    }
  }

  const report = calculateAtsV2Score(structuredJd, evalRes.data, targetResume)
  return { success: true, resume: targetResume, score: Math.round(report.overallScore), report }
}
