/**
 * Recommendation Engine — Index
 *
 * The primary scoring computation runs inside PostgreSQL via the
 * get_ranked_opportunities() RPC (see migration 002).
 *
 * This module provides the application-layer helpers that operate
 * on the results returned by the RPC:
 *   - Match card summaries for opportunity list cards
 *   - Explanation sentences for opportunity detail pages
 *   - Client-side sort + filter (no server round-trip for quick UI changes)
 *
 * IMPORTANT: Do NOT add database scoring logic here.
 * All scoring (skill %, experience, recency, deadline) lives in the RPC.
 */

export { getMatchLabel, buildMatchCardSummary, buildMatchExplanation, sortByMatchScore, filterFeedLocally } from './scoring'
export type { RecommendationFeed, FeedFilters, MatchCardSummary, MatchExplanation, MatchLabel } from './types'
