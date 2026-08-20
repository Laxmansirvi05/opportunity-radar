import type { JDRequirement, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

/**
 * Reads the requirement list off a structured job description.
 *
 * The current schema calls it `requirements`, but evaluations stored before
 * that rename — and they are replayed, not recomputed, by
 * `scoreFromCachedEvaluation` — carry the same objects under `capabilities`.
 * Both shapes have to keep scoring, which is why every consumer previously
 * repeated an `(structuredJd as any).capabilities` fallback inline.
 *
 * Kept as one helper so the legacy key is named in exactly one place: when
 * those old rows have aged out, this is the only thing to delete.
 */
export function getJdRequirements(
  structuredJd: StructuredJD | null | undefined
): JDRequirement[] {
  if (!structuredJd) return []

  if (Array.isArray(structuredJd.requirements)) {
    return structuredJd.requirements
  }

  const legacy = (structuredJd as { capabilities?: unknown }).capabilities
  return Array.isArray(legacy) ? (legacy as JDRequirement[]) : []
}
