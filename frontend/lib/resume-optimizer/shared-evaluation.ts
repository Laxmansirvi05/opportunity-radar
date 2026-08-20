import { calculateAtsV2Score } from '@/lib/ats-checker/scoring-v2'
import type { AtsV2Score } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import type { ParsedResume } from '@/types/resume'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The ATS Checker and the AI Optimiser both score a resume against a job
 * description with the identical pipeline (extractJDIntelligence →
 * evaluateResumeEvidence → calculateAtsV2Score), but each ran its own
 * independent AI calls — and an AI evidence judgment is not perfectly
 * reproducible even at temperature 0, so the same resume and the same job
 * description could (and did — confirmed live, see the note in
 * ats-v2-intelligence.ts) land on two different scores depending on which
 * feature you opened first.
 *
 * Rather than trying to force byte-identical AI output, this reuses the
 * already-computed structuredJd + evidenceMatrix from whichever feature ran
 * first for this exact resume + job description, and recomputes the score
 * from those with the same deterministic calculateAtsV2Score both features
 * already call — guaranteeing the same inputs produce the same number, and
 * skipping two redundant AI calls in the process.
 */

export interface CachedAtsV2Evaluation {
  structuredJd: StructuredJD
  evidenceMatrix: EvidenceMatrix
  createdAt: string
}

function normalizeJd(jd: string): string {
  return jd.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The two row shapes this reads, named rather than cast through `any[]`. */
interface CachedEvaluationPayload {
  structuredJd?: StructuredJD
  evidenceMatrix?: EvidenceMatrix
}

interface AtsReportRow {
  resume_id: string | null
  target_job_description: string | null
  report_data: { atsV2?: CachedEvaluationPayload } | null
  created_at: string
}

interface OptimizationRow {
  original_resume_id: string | null
  job_description: string | null
  baseline_report: CachedEvaluationPayload | null
  created_at: string
}

interface Candidate {
  createdAt: string
  resumeId: string | null
  jobDescription: string
  structuredJd?: StructuredJD
  evidenceMatrix?: EvidenceMatrix
}

/**
 * Looks up the most recent matching evaluation for this user + resume +
 * job description across both `resume_ats_reports` and
 * `resume_optimizations`, within the last 24h, and only when it was
 * computed after the resume itself was last edited (an evaluation of a
 * resume the student has since changed is not a match).
 */
export async function findRecentAtsV2Evaluation(
  supabase: SupabaseClient,
  userId: string,
  resumeId: string | null,
  jobDescription: string,
  resumeUpdatedAt?: string | null
): Promise<CachedAtsV2Evaluation | null> {
  const normalizedTarget = normalizeJd(jobDescription)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [atsRes, optRes] = await Promise.all([
    supabase
      .from('resume_ats_reports')
      .select('resume_id, target_job_description, report_data, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('resume_optimizations')
      .select('original_resume_id, job_description, baseline_report, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const candidates: Candidate[] = []

  for (const r of (atsRes.data ?? []) as AtsReportRow[]) {
    const atsV2 = r.report_data?.atsV2
    if (atsV2?.structuredJd && atsV2?.evidenceMatrix) {
      candidates.push({
        createdAt: r.created_at,
        resumeId: r.resume_id ?? null,
        jobDescription: r.target_job_description ?? '',
        structuredJd: atsV2.structuredJd,
        evidenceMatrix: atsV2.evidenceMatrix,
      })
    }
  }

  for (const r of (optRes.data ?? []) as OptimizationRow[]) {
    const baseline = r.baseline_report
    if (baseline?.structuredJd && baseline?.evidenceMatrix) {
      candidates.push({
        createdAt: r.created_at,
        resumeId: r.original_resume_id ?? null,
        jobDescription: r.job_description ?? '',
        structuredJd: baseline.structuredJd,
        evidenceMatrix: baseline.evidenceMatrix,
      })
    }
  }

  const resumeEditCutoff = resumeUpdatedAt ? new Date(resumeUpdatedAt).getTime() : null

  const match = candidates
    .filter((c) => c.resumeId === resumeId && normalizeJd(c.jobDescription) === normalizedTarget)
    .filter((c) => resumeEditCutoff === null || new Date(c.createdAt).getTime() >= resumeEditCutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  if (!match || !match.structuredJd || !match.evidenceMatrix) return null

  return {
    structuredJd: match.structuredJd,
    evidenceMatrix: match.evidenceMatrix,
    createdAt: match.createdAt,
  }
}

/** Recomputes the score from a cached structuredJd/evidenceMatrix pair against
 *  the current resume — deterministic, so this always matches what a fresh
 *  run against these same inputs would produce. */
export function scoreFromCachedEvaluation(cached: CachedAtsV2Evaluation, resume: ParsedResume): AtsV2Score {
  return calculateAtsV2Score(cached.structuredJd, cached.evidenceMatrix, resume)
}
