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
  /**
   * Concrete "how" — a project brief and tech stack, where to look for a
   * course, or a practice plan for a skill. Optional so older persisted
   * suggestions (stored on resume_optimizations rows before this field
   * existed) still satisfy the type without a migration.
   */
  guidance?: string
}

/**
 * How many suggestions a resume at a given score genuinely needs.
 *
 * A near-ready resume shown the same 6-item checklist as a struggling one
 * reads as busywork and buries the one or two things that actually matter.
 * Bands loosely follow score-band guidance: fewer, higher-signal items as
 * score rises, more (but still bounded) developmental items as it falls.
 */
export function suggestionCountForScore(score: number): number {
  if (score >= 80) return 4
  if (score >= 70) return 6
  if (score >= 50) return 8
  return 9
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
    const siblingTech = (jd.requirements ?? [])
      .filter((r) => r.id !== req.id && (r.category === 'technical_capability' || r.category === 'tooling_environment'))
      .map((r) => r.name)

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
      guidance: guidanceFor(type, req.name, siblingTech),
    })
  }

  gaps.sort((a, b) => (importanceRank[a.importance] ?? 9) - (importanceRank[b.importance] ?? 9))
  return gaps.slice(0, max)
}

/**
 * The concrete "how" behind each suggestion type. Deterministic, not a
 * separate AI call — the checklist already has the exact JD requirement and
 * (for projects) its sibling technical requirements, which is enough to give
 * real direction without another round trip that could fail or drift from
 * what the requirement actually says.
 */
function guidanceFor(type: SuggestionType, requirement: string, siblingTech: string[]): string {
  switch (type) {
    case 'project': {
      const stack = siblingTech.slice(0, 3)
      const stackNote = stack.length > 0
        ? ` Pair it with ${stack.join(', ')} if you can — those are the other technologies this job description calls out.`
        : ''
      return `Build one small, finished project that genuinely uses ${requirement} — a working demo beats an ambitious unfinished one.${stackNote} Push it to GitHub with a short README explaining what it does and why, then list it under Projects.`
    }
    case 'course':
      return `Look for a short, focused course on ${requirement} (4-10 hours — freeCodeCamp, Coursera, or a well-reviewed YouTube series all work). Finish it, then apply what you learned inside one real project so it's demonstrated, not just listed.`
    case 'certification':
      return `Check whether the vendor behind ${requirement} offers an official certification — many have a free or low-cost associate-level option. Once earned, list it under Certifications with the issuing body and date.`
    case 'education':
      return `This is about your academic record, not something you can build your way into before applying — if time is limited, prioritise the project and skill items on this list instead.`
    case 'skill':
    default:
      return `Spend a few focused sessions on ${requirement}: read the official docs, work through 2-3 small exercises, then use it inside an existing or new project so it's backed by real work rather than just a listed keyword.`
  }
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
