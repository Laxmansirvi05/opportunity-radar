import type { RankedOpportunity } from '@/types/opportunity'
import type { MatchCardSummary, MatchExplanation, MatchLabel } from './types'

// ---------------------------------------------------------------------------
// Match Label — converts numeric score to human-readable label
// ---------------------------------------------------------------------------
export function getMatchLabel(score: number): MatchLabel {
  if (score >= 80) return 'Excellent Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Partial Match'
  return 'Low Match'
}

// ---------------------------------------------------------------------------
// Build a compact card summary from a RankedOpportunity
// Used in opportunity cards in the feed
// ---------------------------------------------------------------------------
export function buildMatchCardSummary(opp: RankedOpportunity): MatchCardSummary {
  return {
    match_score:        opp.match_score,
    matched_skills:     opp.matched_skills,
    missing_count:      opp.missing_skills.length,
    skill_coverage_pct: opp.skill_coverage_pct,
    score_label:        getMatchLabel(opp.match_score),
  }
}

// ---------------------------------------------------------------------------
// Build a human-readable explanation sentence for the detail page
// ---------------------------------------------------------------------------
export function buildMatchExplanation(opp: RankedOpportunity): MatchExplanation {
  const label  = getMatchLabel(opp.match_score)
  const covered = opp.matched_skills.length
  const total   = (opp.extracted_skills ?? []).length

  let sentence: string

  if (opp.match_score >= 80) {
    sentence = `You match ${covered} of ${total} required skills — a strong fit for this role.`
  } else if (opp.match_score >= 60) {
    sentence = `You match ${covered} of ${total} skills. Closing ${opp.missing_skills.length} gap${opp.missing_skills.length === 1 ? '' : 's'} would make you a top candidate.`
  } else if (opp.match_score >= 40) {
    sentence = `You match ${covered} of ${total} skills. This role would stretch your current skill set — great for growth.`
  } else {
    sentence = `You match ${covered} of ${total} required skills. Consider building ${opp.missing_skills.slice(0, 2).join(' and ')} through a project before applying.`
  }

  return {
    score_label:          label,
    matched_skills:       opp.matched_skills,
    missing_skills:       opp.missing_skills,
    skill_coverage_pct:   opp.skill_coverage_pct,
    explanation_sentence: sentence,
  }
}

// ---------------------------------------------------------------------------
// Sort a pre-fetched list of RankedOpportunity by match_score DESC
// (Secondary sort: posted_at DESC for equal scores)
// Used for client-side re-sorting after filter changes without a new API call
// ---------------------------------------------------------------------------
export function sortByMatchScore(
  opportunities: RankedOpportunity[]
): RankedOpportunity[] {
  return [...opportunities].sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score
    return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
  })
}

// ---------------------------------------------------------------------------
// Filter a cached feed client-side (avoids a round-trip for simple filters)
// ---------------------------------------------------------------------------
export function filterFeedLocally(
  opportunities: RankedOpportunity[],
  filters: {
    category?:         string
    experience_level?: string
    is_paid?:          boolean
    search?:           string
  }
): RankedOpportunity[] {
  return opportunities.filter((opp) => {
    if (filters.category && opp.category !== filters.category) return false
    if (filters.experience_level && opp.experience_level !== filters.experience_level) return false
    if (filters.is_paid !== undefined && opp.is_paid !== filters.is_paid) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const haystack = `${opp.title} ${opp.category} ${(opp.extracted_skills ?? []).join(' ')}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
