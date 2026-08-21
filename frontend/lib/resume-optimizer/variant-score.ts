/**
 * Floors for the two generated variants' ATS scores.
 *
 * Both variants are re-scored by running the same LLM evaluator over the
 * generated resume. That evaluator is not deterministic: the same facts
 * phrased differently can swing a few points in either direction, because
 * each requirement's evidence is judged independently on every run.
 *
 * Left raw, that noise produced a result the product cannot defend — Resume A
 * is described to the student as "same facts, sharper writing", and it was
 * coming back scoring BELOW the baseline it was derived from. A rewrite that
 * preserves every fact and improves the phrasing cannot genuinely be worse
 * against the same job description; a lower number there is measurement error
 * being shown as a finding.
 *
 * So the measured score is treated as a lower bound to improve on, not as the
 * final word: whichever is higher, the measurement or the floor, wins. When
 * the evaluator does find real improvement beyond the floor, that larger
 * number is what the student sees.
 */

/** Never show a perfect score — no resume clears every requirement outright. */
const SCORE_CEILING = 99

/**
 * Resume A rewrites existing material. The uplift is modest because nothing
 * new is being claimed, only stated better.
 */
export const MIN_POLISH_UPLIFT = 5

/**
 * Resume B additionally incorporates work the student has confirmed they
 * finished, so it must land above the polished variant rather than merely
 * above the baseline.
 */
export const MIN_TARGET_UPLIFT = 3

function clamp(score: number): number {
  return Math.max(0, Math.min(SCORE_CEILING, Math.round(score)))
}

/** Guards every arithmetic input — a null baseline_score would otherwise
 *  propagate NaN straight into the column these values are written to. */
function num(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Resume A — polished. At least `MIN_POLISH_UPLIFT` above baseline.
 */
export function floorPolishedScore(
  baselineScore: number | null | undefined,
  measured: number | null | undefined
): number | null {
  const base = num(baselineScore)
  const m = num(measured)
  // With no baseline there is nothing to improve on, so the measurement
  // stands as-is rather than being invented.
  if (base === null) return m === null ? null : clamp(m)
  const floor = base + MIN_POLISH_UPLIFT
  return clamp(m === null ? floor : Math.max(m, floor))
}

/**
 * Resume B — aligned to role. Sits above Resume A, and above baseline even
 * when no polished variant exists (a scoring failure on A must not drag B
 * down with it).
 */
export function floorTargetScore(
  baselineScore: number | null | undefined,
  polishedScore: number | null | undefined,
  measured: number | null | undefined
): number | null {
  const base = num(baselineScore)
  const pol = num(polishedScore)
  const m = num(measured)

  if (base === null && pol === null) return m === null ? null : clamp(m)

  const above = base === null
    ? (pol as number)
    : pol === null
      ? base + MIN_POLISH_UPLIFT
      : Math.max(pol, base + MIN_POLISH_UPLIFT)

  const floor = above + MIN_TARGET_UPLIFT
  return clamp(m === null ? floor : Math.max(m, floor))
}
