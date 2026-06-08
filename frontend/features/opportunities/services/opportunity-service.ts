import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import {
  OpportunityWithDetails,
  SearchFilters,
  PAGE_SIZE,
} from '@/types/opportunity'

type SupabaseClientType = SupabaseClient<Database>

/**
 * Builds and executes a search query against the opportunities table.
 *
 * Sort order per App-Flow §5.5.1:
 *   Closing Soon first → newest posted_at DESC
 *
 * Always filters to status IN ('Published', 'Closing Soon').
 * Full-text search uses the idx_opportunities_fts GIN index.
 */
export async function searchOpportunities(
  supabase: SupabaseClientType,
  filters: SearchFilters
): Promise<{ data: OpportunityWithDetails[]; count: number }> {
  const page = filters.page ?? 0
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Select opportunities with joined company and tags
  let query = supabase
    .from('opportunities')
    .select(
      `
      *,
      companies (id, name, logo_url),
      opportunity_tags (tag_name)
    `,
      { count: 'exact' }
    )
    .in('status', ['Published', 'Closing Soon'])

  // ── Full-text search ──────────────────────────────────────────────
  const compIds = await getMatchingCompanyIds(supabase, filters.q)
  query = applySearchModifier(query, filters.q, compIds)

  // ── Category filter ───────────────────────────────────────────────
  if (filters.category && filters.category.length > 0) {
    query = query.in('category', filters.category)
  }

  // ── Mode filter ───────────────────────────────────────────────────
  if (filters.mode && filters.mode.length > 0) {
    query = query.in('mode', filters.mode)
  }

  // ── Compensation filter ───────────────────────────────────────────
  if (filters.is_paid !== undefined) {
    query = query.eq('is_paid', filters.is_paid)
  }

  // ── Experience level filter ───────────────────────────────────────
  if (filters.experience_level && filters.experience_level.length > 0) {
    query = query.in('experience_level', filters.experience_level)
  }

  // ── Freshness filter (posted_at >= NOW - interval) ────────────────
  if (filters.fresh) {
    const interval = getFreshnessInterval(filters.fresh)
    if (interval) {
      const cutoff = new Date(Date.now() - interval)
      query = query.gte('posted_at', cutoff.toISOString())
    }
  }

  // ── Deadline filter ───────────────────────────────────────────────
  if (filters.deadline) {
    const interval = getDeadlineInterval(filters.deadline)
    if (interval) {
      const now = new Date()
      const cutoff = new Date(now.getTime() + interval)
      query = query
        .gte('deadline', now.toISOString())
        .lte('deadline', cutoff.toISOString())
    }
  }

  // ── Location filter (ilike) ───────────────────────────────────────
  if (filters.location && filters.location.trim().length > 0) {
    query = query.ilike('location', `%${filters.location.trim()}%`)
  }

  // ── Sort order ────────────────────────────────────────────────────
  // App-Flow §5.5.1: Closing Soon first, then newest
  // Supabase doesn't support CASE-based ordering, so we do a two-level sort:
  // The 'Closing Soon' status sorts before 'Published' alphabetically,
  // but we need explicit control — sort by status ASC puts 'Closing Soon' first.
  query = query
    .order('status', { ascending: true })      // 'Closing Soon' < 'Published'
    .order('posted_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Search query error:', error)
    return { data: [], count: 0 }
  }

  return {
    data: (data ?? []) as unknown as OpportunityWithDetails[],
    count: count ?? 0,
  }
}

/**
 * Fetches aggregate stats for the search results header.
 * Returns total opportunity count, distinct company count, and new-today count.
 */
export async function getSearchStats(
  supabase: SupabaseClientType,
  filters: SearchFilters
): Promise<{ totalJobs: number; totalCompanies: number; newToday: number }> {
  // Total count comes from the main search query (count: 'exact')
  // For company count and new-today, we run lightweight queries

  const compIds = await getMatchingCompanyIds(supabase, filters.q)

  // Distinct company count
  let companyQuery = supabase
    .from('opportunities')
    .select('company_id', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .not('company_id', 'is', null)

  companyQuery = applySearchModifier(companyQuery, filters.q, compIds)

  // New today count
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let newTodayQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .gte('posted_at', todayStart.toISOString())

  newTodayQuery = applySearchModifier(newTodayQuery, filters.q, compIds)

  const [companyResult, newTodayResult] = await Promise.all([
    companyQuery,
    newTodayQuery,
  ])

  return {
    totalJobs: 0, // Filled by caller from main query count
    totalCompanies: companyResult.count ?? 0,
    newToday: newTodayResult.count ?? 0,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function getFreshnessInterval(fresh: string): number | null {
  switch (fresh) {
    case '1h':
      return 1 * 60 * 60 * 1000
    case '6h':
      return 6 * 60 * 60 * 1000
    case '24h':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

function getDeadlineInterval(deadline: string): number | null {
  switch (deadline) {
    case '24h':
      return 24 * 60 * 60 * 1000
    case '1w':
      return 7 * 24 * 60 * 60 * 1000
    case '1m':
      return 30 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

async function getMatchingCompanyIds(
  supabase: SupabaseClientType,
  q: string | undefined
): Promise<string[]> {
  if (!q || q.trim().length === 0) return []
  const { data: comps } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', `%${q.trim()}%`)
  return comps?.map((c) => c.id) || []
}

function applySearchModifier(query: any, q: string | undefined, compIds: string[]) {
  if (!q || q.trim().length === 0) return query
  const term = q.trim()
  if (compIds.length > 0) {
    const safeQ = term.replace(/"/g, '""')
    return query.or(`fts.plfts(english)."${safeQ}",company_id.in.(${compIds.join(',')})`)
  } else {
    return query.textSearch('fts', term, { type: 'plain', config: 'english' })
  }
}
