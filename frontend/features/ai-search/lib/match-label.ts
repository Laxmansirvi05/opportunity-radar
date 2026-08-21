/**
 * Turns the agent's 0–100 fit score into a word.
 *
 * The number was doing more harm than good on a results card. "90" reads as a
 * precision the score does not have — it is one model's judgement of a resume
 * against a posting, not a measurement — and students treat two points of
 * difference as meaningful when it is noise. A band says the same thing at the
 * resolution the score actually has.
 *
 * The ordering still carries: results stay sorted by the underlying score, so
 * a stronger match is still above a weaker one even when both read "Strong
 * match".
 */

export type MatchLevel = {
  /** What the card shows in place of the number. */
  label: string
  /** Tailwind classes for the badge, using the app's own container tokens. */
  className: string
}

const EXCELLENT: MatchLevel = {
  label: 'Excellent match',
  className: 'bg-secondary-container text-on-secondary-container',
}
const STRONG: MatchLevel = {
  label: 'Strong match',
  className: 'bg-primary-container text-on-primary-container',
}
const GOOD: MatchLevel = {
  label: 'Good match',
  className: 'bg-tertiary-container text-on-tertiary-container',
}
const WORTH_A_LOOK: MatchLevel = {
  label: 'Worth a look',
  className: 'bg-surface-container text-on-surface-variant',
}

/**
 * Thresholds sit where the agent's own filtering does: it already discards
 * anything it judges a poor fit, so the lowest band a student can see is
 * "worth a look" rather than a discouraging label for a result we chose to
 * show them.
 */
export function matchLevelForScore(score: number | null | undefined): MatchLevel {
  if (typeof score !== 'number' || Number.isNaN(score)) return WORTH_A_LOOK
  if (score >= 90) return EXCELLENT
  if (score >= 78) return STRONG
  if (score >= 65) return GOOD
  return WORTH_A_LOOK
}
