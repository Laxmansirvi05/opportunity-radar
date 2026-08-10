import type { ParsedResume } from '@/types/resume'
import type { Suggestion, OptimizationTier } from '@/lib/resume-optimizer/tiers'

export interface OptimizationRun {
  id: string
  target_role: string
  company_name: string
  job_description: string
  source_resume: ParsedResume
  baseline_score: number
  baseline_report: unknown
  tier: OptimizationTier
  suggestions: Suggestion[]
  polished_resume: ParsedResume | null
  polished_score: number | null
  target_resume: ParsedResume | null
  target_score: number | null
  created_at: string
  updated_at: string
}

export interface RunSummary {
  id: string
  target_role: string
  company_name: string
  baseline_score: number
  tier: OptimizationTier
  polished_score: number | null
  target_score: number | null
  created_at: string
  updated_at: string
}
