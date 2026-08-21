import { suggestionCountForScore } from './gap-suggestions'
import type { GapSuggestion } from '@/features/resume-toolkit/lib/schema/resume/ats-check'

/**
 * Which JD requirements the ATS results page should look for certifications
 * against, and how many.
 *
 * The count reuses `suggestionCountForScore` rather than inventing a second
 * score ladder — the gap checklist and the certifications beneath it must
 * not disagree about how much work this resume needs. It is then capped:
 * the checklist can carry five items and still read as a plan, but five
 * course cards reads as a shop.
 */

/** No more cards than this, whatever the score budget allows. */
export const MAX_CERTIFICATION_CARDS = 4

/**
 * Every suggestion type is a candidate for a certification.
 *
 * `project` was excluded at first, on the reasoning that building something
 * closes it rather than enrolling in something. That was wrong in practice:
 * typeForCategory maps `technical_capability` and `tooling_environment` — most
 * of a technical job description, things like Docker, MongoDB, JWT — onto
 * `project`, so excluding it meant a backend resume produced no certifications
 * at all. The two routes are complementary: the checklist above suggests
 * building it, this offers a course on it. Requirements a student cannot act
 * on (experience level, work authorisation) never become suggestions in the
 * first place, so there is nothing further to filter out here.
 */

export function selectCertificationTargets(
  suggestions: GapSuggestion[],
  score: number
): string[] {
  const limit = Math.min(suggestionCountForScore(score), MAX_CERTIFICATION_CARDS)
  if (limit <= 0) return []

  const seen = new Set<string>()
  const targets: string[] = []

  for (const suggestion of suggestions) {
    // An item the student has already ticked off is not a gap any more.
    if (suggestion.completed) continue

    const requirement = suggestion.requirement?.trim()
    if (!requirement) continue

    // One requirement never claims two cards, even when the checklist
    // raised it as both a skill and a course.
    const key = requirement.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    targets.push(requirement)
    if (targets.length >= limit) break
  }

  return targets
}

/** The fields a match is judged on. Structurally the catalogue row. */
export interface CertificationMatchCandidate {
  id: string
  title: string
  topics: string[] | null
  is_free: boolean
}

/**
 * Picks the best certification for a requirement, or null when none of the
 * candidates genuinely relate to it.
 *
 * The catalogue search is deliberately loose — it ORs a stemmed full-text
 * match with title/provider `ilike` so partial words still find things — and
 * it orders by price and title, not relevance. Taking its first row
 * therefore produced confidently wrong pairings against the live data:
 * "Docker" returned a Kubernetes course, "TypeScript" returned "AI-Assisted
 * Code Modernization", and "Node.js" returned "Master Dialogflow CX Agents".
 *
 * So the term has to actually appear in the title or the topics. A
 * requirement with no real match returns null and shows no card at all —
 * pointing a student at an unrelated course to fill a slot is worse than
 * leaving the slot empty.
 */
export function pickBestCertification<T extends CertificationMatchCandidate>(
  candidates: T[],
  requirement: string
): T | null {
  const term = requirement.trim().toLowerCase()
  if (!term) return null

  const scored = candidates
    .map((candidate) => {
      const title = candidate.title.toLowerCase()
      const inTitle = title.includes(term)
      const inTopics = (candidate.topics ?? []).some((t) => t.toLowerCase().includes(term))
      if (!inTitle && !inTopics) return null

      return {
        candidate,
        // A title match is a stronger signal than a topic tag.
        rank: (inTitle ? 0 : 1) * 100 + (candidate.is_free ? 0 : 10) + Math.min(title.length, 9) / 10,
      }
    })
    .filter((entry): entry is { candidate: T; rank: number } => entry !== null)

  if (scored.length === 0) return null

  scored.sort((a, b) => a.rank - b.rank)
  return scored[0].candidate
}
