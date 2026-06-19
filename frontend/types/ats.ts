import { z } from 'zod'

// ---------------------------------------------------------------------------
// Skill Importance (Change 7 — deterministic ranking)
// ---------------------------------------------------------------------------
export const SkillImportanceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export type SkillImportance = z.infer<typeof SkillImportanceSchema>

export interface RankedMissingSkill {
  skill: string
  importance: SkillImportance
}

// ---------------------------------------------------------------------------
// Gap Analysis (Change 6 — bonus_skills)
// ---------------------------------------------------------------------------
export interface GapAnalysis {
  matched_skills: string[]
  project_matched_skills: string[]
  missing_skills: RankedMissingSkill[]
  bonus_skills: string[]
  skill_coverage_pct: number
  experience_gap: ExperienceGap | null
  education_gap: EducationGap | null
  project_gap: string[]
}

export interface ExperienceGap {
  required: string
  student_has: string
  gap: string
}

export interface EducationGap {
  required: string
  student_has: string
  gap: string
}

// ---------------------------------------------------------------------------
// ATS Score Components (for explainability)
// ---------------------------------------------------------------------------
export interface ATSScoreBreakdown {
  skill_score: number       // 0.0 to 1.0
  project_score: number     // 0.0 to 1.0
  experience_score: number  // 0.0 to 1.0
  education_score: number   // 0.0 to 1.0
  final_score: number       // 0 to 100 (integer)
}

// ---------------------------------------------------------------------------
// Full ATS Analysis Result
// ---------------------------------------------------------------------------
export interface ATSAnalysisResult {
  ats_score: number
  score_breakdown: ATSScoreBreakdown
  gap_analysis: GapAnalysis
  improvement_score: number
  improvement_suggestions: string[]
  resume_freshness: 'fresh' | 'stale' | 'unknown'
}

// ---------------------------------------------------------------------------
// ATS Fallback (no verified resume)
// ---------------------------------------------------------------------------
export interface ATSFallback {
  fallback: true
  ats_score: null
  message: string
}

export type ATSResponse = ATSAnalysisResult | ATSFallback

// ---------------------------------------------------------------------------
// API Input
// ---------------------------------------------------------------------------
export const ATSAnalyzeQuerySchema = z.object({
  opportunity_id: z.string().uuid('opportunity_id must be a valid UUID'),
})
export type ATSAnalyzeQuery = z.infer<typeof ATSAnalyzeQuerySchema>

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------
export function isATSFallback(result: ATSResponse): result is ATSFallback {
  return 'fallback' in result && result.fallback === true
}
