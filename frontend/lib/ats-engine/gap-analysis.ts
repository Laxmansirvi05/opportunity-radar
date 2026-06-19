import type { GapAnalysis, RankedMissingSkill } from '@/types/ats'
import { rankMissingSkills } from './scoring'

// ---------------------------------------------------------------------------
// Compute full gap analysis
// Implements Change 6 (bonus_skills) + Change 7 (importance ranking)
// ---------------------------------------------------------------------------
export function computeGapAnalysis(
  studentSkills:      string[],
  projectKeywords:    string[],
  matchedSkills:      string[],
  projectMatched:     string[],
  oppSkills:          string[],
  opportunityTitle:   string,
  frequencyMap:       Map<string, number>
): GapAnalysis {
  const allStudentSkills = new Set([...studentSkills, ...projectKeywords])
  const oppSkillSet      = new Set(oppSkills)

  // Missing skills: required by opportunity but not covered by student at all
  const rawMissing = oppSkills.filter((s) => !allStudentSkills.has(s))

  // Ranked missing skills (HIGH / MEDIUM / LOW)
  const rankedMissing: RankedMissingSkill[] = rankMissingSkills(
    rawMissing,
    opportunityTitle,
    frequencyMap
  )

  // Bonus skills: student has these but opportunity doesn't require them
  const bonusSkills = studentSkills.filter((s) => !oppSkillSet.has(s))

  // Project gap: missing skills that the student also doesn't have in any project
  const projectKeywordSet = new Set(projectKeywords)
  const projectGap = rawMissing.filter((s) => !projectKeywordSet.has(s))

  // Skill coverage %
  const covered = matchedSkills.length + projectMatched.length
  const skillCoveragePct =
    oppSkills.length === 0 ? 0 : Math.round((covered / oppSkills.length) * 1000) / 10

  return {
    matched_skills:         matchedSkills,
    project_matched_skills: projectMatched,
    missing_skills:         rankedMissing,
    bonus_skills:           bonusSkills,
    skill_coverage_pct:     skillCoveragePct,
    project_gap:            projectGap,
    experience_gap:         null,  // Populated by index.ts after experience_score < 1.0
    education_gap:          null,  // Populated by index.ts after education_score < 1.0
  }
}

// ---------------------------------------------------------------------------
// Generate human-readable improvement suggestions
// ---------------------------------------------------------------------------
export function generateImprovementSuggestions(
  missingSkills:   RankedMissingSkill[],
  bonusSkills:     string[],
  projectGap:      string[],
  experienceFit:   boolean,
  educationFit:    boolean
): string[] {
  const suggestions: string[] = []

  const highPriority = missingSkills.filter((s) => s.importance === 'HIGH')
  const medPriority  = missingSkills.filter((s) => s.importance === 'MEDIUM')

  if (highPriority.length > 0) {
    suggestions.push(
      `Add these high-priority skills to your resume: ${highPriority.map((s) => s.skill).join(', ')}.`
    )
  }

  if (medPriority.length > 0) {
    suggestions.push(
      `Consider adding: ${medPriority.map((s) => s.skill).join(', ')} to strengthen your profile.`
    )
  }

  if (projectGap.length > 0) {
    suggestions.push(
      `Build a project using ${projectGap.slice(0, 2).join(' or ')} to demonstrate these skills practically.`
    )
  }

  if (experienceFit) {
    suggestions.push('Your experience level matches this role perfectly — no changes needed.')
  }

  if (educationFit) {
    suggestions.push('Your education meets or exceeds this role\'s requirements.')
  }

  if (bonusSkills.length > 0) {
    suggestions.push(
      `You bring extra value with: ${bonusSkills.slice(0, 5).join(', ')} — highlight these in your cover letter.`
    )
  }

  return suggestions
}
