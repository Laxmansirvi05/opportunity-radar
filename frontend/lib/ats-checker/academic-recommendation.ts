import type { ParsedResume } from '@/types/resume'

export interface AcademicRecommendation {
  visible: boolean
  message: string
  observed: string
  rule: string
}

const ENGINEERING_DEGREE_MARKERS = [
  'b.tech',
  'btech',
  'b.e.',
  'bachelor of engineering',
  'bachelor of technology',
]

const MIN_RECOMMENDED_CGPA = 7.5

function isCurrentlyPursuing(edu: { graduation_year?: number | null }): boolean {
  if (!edu.graduation_year) return true
  const currentYear = new Date().getFullYear()
  return edu.graduation_year >= currentYear
}

/**
 * A deterministic, mode-agnostic rule: a B.Tech/B.E. student still in
 * progress with a below-7.5 CGPA is flagged, since several internship and
 * graduate pipelines use that as a hard cutoff. This does not depend on a
 * job description or the V2 engine at all — it is true regardless of which
 * role the student is targeting, or whether they targeted one at all — so
 * it lives as its own top-level field rather than being smuggled into
 * either scoring engine's output.
 */
export function computeAcademicRecommendation(
  education: ParsedResume['education'] | undefined
): AcademicRecommendation | null {
  if (!education || education.length === 0) return null

  for (const edu of education) {
    const degree = (edu.degree || '').toLowerCase()
    const isEngineeringDegree = ENGINEERING_DEGREE_MARKERS.some((marker) => degree.includes(marker))
    if (!isEngineeringDegree) continue
    if (!isCurrentlyPursuing(edu)) continue
    if (edu.gpa === undefined || edu.gpa === null) continue

    const cgpa = edu.gpa
    if (cgpa < MIN_RECOMMENDED_CGPA) {
      return {
        visible: true,
        message: `Your current CGPA is ${cgpa}. Aim to improve it to at least ${MIN_RECOMMENDED_CGPA}, as some internship and graduate recruitment processes use academic cutoffs.`,
        observed: String(cgpa),
        rule: `CGPA >= ${MIN_RECOMMENDED_CGPA} recommended while the degree is still in progress`,
      }
    }
    // This entry doesn't warrant a recommendation — keep scanning the rest
    // of the education list rather than stopping at the first engineering
    // degree found, in case a later entry is the one that's actually weak.
  }

  return null
}
