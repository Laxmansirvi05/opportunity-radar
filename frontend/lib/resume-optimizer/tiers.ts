import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

/**
 * What an optimisation run should produce, decided from the baseline score.
 *
 * The thresholds exist so the product does not do pointless work — and does not
 * imply a strong resume is weak. A resume already scoring 90+ against the target
 * role does not need rewriting, and telling a student otherwise to justify a
 * feature would be dishonest.
 */
export type OptimizationTier = 'full' | 'polish_only' | 'already_strong'

export const POLISH_ONLY_THRESHOLD = 80
export const ALREADY_STRONG_THRESHOLD = 90

export function decideTier(baselineScore: number): OptimizationTier {
  if (baselineScore >= ALREADY_STRONG_THRESHOLD) return 'already_strong'
  if (baselineScore >= POLISH_ONLY_THRESHOLD) return 'polish_only'
  return 'full'
}

export function tierPlan(tier: OptimizationTier): {
  generatesPolished: boolean
  generatesTarget: boolean
  generatesSuggestions: boolean
  headline: string
  explanation: string
} {
  switch (tier) {
    case 'already_strong':
      return {
        generatesPolished: false,
        generatesTarget: false,
        generatesSuggestions: false,
        headline: 'Your resume is already strong for this role',
        explanation:
          'It scores highly against this job description, so rewriting it would risk making it worse. Apply with what you have.',
      }
    case 'polish_only':
      return {
        generatesPolished: true,
        generatesTarget: false,
        generatesSuggestions: true,
        headline: 'Your resume is close — it mainly needs polish',
        explanation:
          'The substance is there. A cleaner structure and sharper wording should be enough, so no second version is generated.',
      }
    case 'full':
    default:
      return {
        generatesPolished: true,
        generatesTarget: true,
        generatesSuggestions: true,
        headline: 'There is real room to improve this resume',
        explanation:
          'You get a polished version of what you have today, plus a target version showing where you could be after closing the gaps below.',
      }
  }
}

// ── Suggestions ─────────────────────────────────────────────────────────────

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

/**
 * Whether the target resume may be downloaded.
 *
 * Every suggestion must be confirmed done. The target resume presents suggested
 * work as accomplishments, so releasing it before the work exists would hand a
 * student a resume making claims they cannot support in an interview. The gate
 * is the whole reason this is safe to build.
 */
export function targetResumeUnlocked(suggestions: Suggestion[]): boolean {
  if (suggestions.length === 0) return true
  return suggestions.every((s) => s.completed)
}

export function completionProgress(suggestions: Suggestion[]): { done: number; total: number } {
  return {
    done: suggestions.filter((s) => s.completed).length,
    total: suggestions.length,
  }
}
