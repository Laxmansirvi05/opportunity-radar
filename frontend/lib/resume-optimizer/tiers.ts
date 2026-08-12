import type { Suggestion } from '@/lib/ats-checker/gap-suggestions'

export { deriveSuggestions, suggestionCountForScore, type Suggestion, type SuggestionType } from '@/lib/ats-checker/gap-suggestions'

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
// Suggestion / deriveSuggestions now live in lib/ats-checker/gap-suggestions.ts
// (re-exported above) so the Optimiser and the ATS Checker share one deriver.

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
