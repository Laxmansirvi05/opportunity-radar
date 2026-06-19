import type { RankedMissingSkill, SkillImportance } from '@/types/ats'

// ---------------------------------------------------------------------------
// ATS Scoring Weights (approved formula from TDD-003)
// ---------------------------------------------------------------------------
export const ATS_WEIGHTS = {
  skill:       0.55,
  project:     0.15,
  experience:  0.20,
  education:   0.10,
} as const

// ---------------------------------------------------------------------------
// Skill normalisation (lowercase + trim + remove unsafe chars)
// ---------------------------------------------------------------------------
export function normaliseSkill(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#+.\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normaliseSkillArray(skills: string[]): string[] {
  return [...new Set(skills.map(normaliseSkill).filter((s) => s.length > 1))].sort()
}

// ---------------------------------------------------------------------------
// Skill Score (0.0 – 1.0)
// ---------------------------------------------------------------------------
export function computeSkillScore(
  studentSkills: string[],
  oppSkills: string[]
): { score: number; matched: string[] } {
  if (oppSkills.length === 0) return { score: 0.5, matched: [] }

  const oppSet = new Set(oppSkills)
  const matched = studentSkills.filter((s) => oppSet.has(s))
  const score   = Math.min(matched.length / oppSkills.length, 1.0)

  return { score, matched }
}

// ---------------------------------------------------------------------------
// Project Score (0.0 – 1.0)
// Skills already matched in computeSkillScore are excluded to avoid double-counting
// ---------------------------------------------------------------------------
export function computeProjectScore(
  projectKeywords: string[],
  oppSkills: string[],
  alreadyMatched: string[]
): { score: number; matched: string[] } {
  if (oppSkills.length === 0) return { score: 0.5, matched: [] }

  const oppSet      = new Set(oppSkills)
  const matchedSet  = new Set(alreadyMatched)
  const projectOnly = projectKeywords.filter((k) => !matchedSet.has(k))
  const matched     = projectOnly.filter((k) => oppSet.has(k))
  const score       = Math.min(matched.length / oppSkills.length, 1.0)

  return { score, matched }
}

// ---------------------------------------------------------------------------
// Experience Score (0.0 – 1.0)
// ---------------------------------------------------------------------------
export type ExperienceLevel = 'Fresher' | 'Junior' | 'Mid-Level' | 'Senior' | 'Any'

export function deriveStudentLevel(totalMonths: number): ExperienceLevel {
  if (totalMonths === 0) return 'Fresher'
  if (totalMonths <= 24) return 'Junior'
  if (totalMonths <= 60) return 'Mid-Level'
  return 'Senior'
}

export function computeExperienceScore(
  studentLevel: ExperienceLevel,
  requiredLevel: string | null
): number {
  if (!requiredLevel || requiredLevel === 'Any') return 1.0
  if (requiredLevel === studentLevel) return 1.0

  const levelOrder: ExperienceLevel[] = ['Fresher', 'Junior', 'Mid-Level', 'Senior']
  const studentIdx  = levelOrder.indexOf(studentLevel)
  const requiredIdx = levelOrder.indexOf(requiredLevel as ExperienceLevel)

  if (requiredIdx === -1) return 0.7  // Unknown requirement → partial pass

  // Overqualified: slight penalty (not auto-rejected in student context)
  if (studentIdx > requiredIdx) return 0.8
  // Under-qualified
  const gap = requiredIdx - studentIdx
  if (gap === 1) return 0.5
  if (gap >= 2)  return 0.2

  return 0.7
}

// ---------------------------------------------------------------------------
// Education Score (0.0 – 1.0)
// ---------------------------------------------------------------------------
type DegreeLevel = 'doctorate' | 'masters' | 'bachelors' | 'diploma' | 'other'

const DEGREE_RANK: Record<DegreeLevel, number> = {
  doctorate: 4,
  masters:   3,
  bachelors: 2,
  diploma:   1,
  other:     0,
}

export function computeEducationScore(
  studentDegreeLevel: DegreeLevel | undefined,
  requiredDegree: string | null
): number {
  if (!requiredDegree) return 1.0  // No requirement = full score

  const requiredLevel = requiredDegree.toLowerCase() as DegreeLevel
  const requiredRank  = DEGREE_RANK[requiredLevel] ?? 0
  const studentRank   = studentDegreeLevel ? DEGREE_RANK[studentDegreeLevel] : 0

  return studentRank >= requiredRank ? 1.0 : 0.5
}

// ---------------------------------------------------------------------------
// Compute total ATS Score (0 – 100)
// ---------------------------------------------------------------------------
export function computeATSScore(components: {
  skill_score:      number
  project_score:    number
  experience_score: number
  education_score:  number
}): number {
  const raw =
    components.skill_score       * ATS_WEIGHTS.skill +
    components.project_score     * ATS_WEIGHTS.project +
    components.experience_score  * ATS_WEIGHTS.experience +
    components.education_score   * ATS_WEIGHTS.education

  return Math.round(raw * 100)
}

// ---------------------------------------------------------------------------
// Compute Improvement Score (simulated perfect skill match)
// ---------------------------------------------------------------------------
export function computeImprovementScore(components: {
  project_score:    number
  experience_score: number
  education_score:  number
}): number {
  const raw =
    1.0                            * ATS_WEIGHTS.skill +      // Simulated perfect skill coverage
    components.project_score       * ATS_WEIGHTS.project +
    components.experience_score    * ATS_WEIGHTS.experience +
    components.education_score     * ATS_WEIGHTS.education

  return Math.round(raw * 100)
}

// ---------------------------------------------------------------------------
// Skill Importance Ranking (Change 7 — deterministic, no AI)
// ---------------------------------------------------------------------------
export function rankMissingSkill(
  skill: string,
  opportunityTitle: string,
  frequencyMap: Map<string, number>
): SkillImportance {
  const maxFrequency  = Math.max(...Array.from(frequencyMap.values()), 1)
  const skillFreq     = frequencyMap.get(skill) ?? 0
  const frequencyScore = skillFreq / maxFrequency

  // Position score: is the skill in the job title?
  const titleLower   = opportunityTitle.toLowerCase()
  const inTitle      = titleLower.includes(skill)
  const positionScore = inTitle ? 1.0 : 0.2

  const importanceScore = frequencyScore * 0.6 + positionScore * 0.4

  if (importanceScore >= 0.7) return 'HIGH'
  if (importanceScore >= 0.4) return 'MEDIUM'
  return 'LOW'
}

export function rankMissingSkills(
  missingSkills: string[],
  opportunityTitle: string,
  frequencyMap: Map<string, number>
): RankedMissingSkill[] {
  return missingSkills
    .map((skill) => ({
      skill,
      importance: rankMissingSkill(skill, opportunityTitle, frequencyMap),
    }))
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return order[a.importance] - order[b.importance]
    })
}
