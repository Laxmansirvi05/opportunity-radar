import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

/**
 * The single deterministic gap -> checklist deriver, shared by the ATS
 * Checker (/resume/ats) and the Resume Optimiser (/resume/copilot). Both
 * features score against the same StructuredJD + EvidenceMatrix produced by
 * the V2 engine, so they must turn "what's missing" into the same checklist
 * — a second, independently-invented set of suggestions for the same
 * analysis would be exactly the kind of competing logic this module exists
 * to prevent.
 */

export type SuggestionType = 'project' | 'course' | 'skill' | 'certification' | 'education'

export interface Suggestion {
  id: string
  type: SuggestionType
  title: string
  detail: string
  /** The JD requirement this closes, so the student can see why it is here. */
  requirement: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  completed: boolean
  completed_at?: string | null
}

/** Satisfaction levels that count as a genuine gap worth acting on. */
const UNMET = new Set(['none', 'insufficient', 'partial'])

/** Categories that cannot honestly be closed by a student before applying. */
const NOT_ACTIONABLE = new Set(['experience_level', 'location_auth', 'other'])

/**
 * Map a JD requirement category onto the kind of work that would close it.
 *
 * Experience is deliberately excluded: a student cannot manufacture years of
 * professional experience, and suggesting they add it invites fabrication.
 */
function typeForCategory(category: string): SuggestionType {
  switch (category) {
    case 'certification':
      return 'certification'
    case 'education':
      return 'education'
    case 'domain_knowledge':
      return 'course'
    case 'technical_capability':
    case 'tooling_environment':
      return 'project'
    default:
      return 'skill'
  }
}

/**
 * Derive the checklist from requirements the resume does not yet evidence.
 *
 * This is what makes the feature adaptive rather than formulaic: suggestions
 * come from measured gaps, so a resume that already demonstrates most of the
 * job description produces one or two items — or none — instead of a fixed
 * list of busywork.
 */
export function deriveSuggestions(
  jd: StructuredJD,
  matrix: EvidenceMatrix,
  options: { max?: number } = {}
): Suggestion[] {
  const max = options.max ?? 6
  const byId = new Map(
    (matrix.evaluations ?? []).map((e) => [e.capabilityId, e])
  )

  const importanceRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const gaps: Suggestion[] = []

  for (const req of jd.requirements ?? []) {
    if (NOT_ACTIONABLE.has(req.category)) continue

    const evaluation = byId.get(req.id)

    // An unevaluated requirement is not evidence of a gap — we simply do not
    // know. Treating unknown as missing would invent work for the student.
    if (!evaluation) continue
    if (!UNMET.has(evaluation.satisfaction)) continue

    const type = typeForCategory(req.category)
    gaps.push({
      id: req.id,
      type,
      title: titleFor(type, req.name),
      detail:
        evaluation.gapReason?.trim() ||
        `The job description asks for ${req.name}, and your resume does not yet show it.`,
      requirement: req.name,
      importance: req.importance,
      completed: false,
      completed_at: null,
    })
  }

  gaps.sort((a, b) => (importanceRank[a.importance] ?? 9) - (importanceRank[b.importance] ?? 9))
  return gaps.slice(0, max)
}

function titleFor(type: SuggestionType, requirement: string): string {
  switch (type) {
    case 'project':
      return `Build a project using ${requirement}`
    case 'course':
      return `Take a short course on ${requirement}`
    case 'certification':
      return `Earn a ${requirement} certification`
    case 'education':
      return `Strengthen your academic record: ${requirement}`
    case 'skill':
    default:
      return `Learn ${requirement}`
  }
}
