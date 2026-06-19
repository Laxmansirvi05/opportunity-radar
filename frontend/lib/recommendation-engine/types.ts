import type { RankedOpportunity } from '@/types/opportunity'

// ---------------------------------------------------------------------------
// Recommendation Engine Types (Phase 5 — lib-layer types)
// The RPC does all heavy lifting in PostgreSQL.
// These types represent the application-layer envelope.
// ---------------------------------------------------------------------------

/**
 * Recommendation feed returned to the client.
 * Each item is a ranked opportunity with match metadata.
 */
export interface RecommendationFeed {
  opportunities: RankedOpportunity[]
  count:         number
  has_resume:    boolean      // false → no verified resume → generic recency feed
  filters_used:  FeedFilters
}

export interface FeedFilters {
  category?:          string
  location?:          string
  experience_level?:  string
  limit:              number
}

/**
 * Client-side match summary shown in opportunity cards.
 */
export interface MatchCardSummary {
  match_score:        number
  matched_skills:     string[]
  missing_count:      number
  skill_coverage_pct: number
  score_label:        MatchLabel
}

export type MatchLabel = 'Excellent Match' | 'Good Match' | 'Partial Match' | 'Low Match'

/**
 * Explanation object shown in the opportunity detail page.
 */
export interface MatchExplanation {
  score_label:          MatchLabel
  matched_skills:       string[]
  missing_skills:       string[]
  skill_coverage_pct:   number
  explanation_sentence: string
}
