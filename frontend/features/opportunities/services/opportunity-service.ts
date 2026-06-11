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
 */
export async function searchOpportunities(
  supabase: SupabaseClientType,
  filters: SearchFilters
): Promise<{ data: OpportunityWithDetails[]; count: number }> {
  const page = filters.page ?? 0
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [compIds, tagOpps] = await Promise.all([
    getMatchingCompanyIds(supabase, filters.q),
    getMatchingTagOpps(supabase, filters.q),
  ])

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

  query = applyAllFilters(query, filters, compIds, tagOpps)

  // Sort order
  if (filters.sort === 'newest') {
    query = query.order('posted_at', { ascending: false })
  } else if (filters.sort === 'deadline') {
    // Only show things with a deadline if we explicitly sort by it
    query = query
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
  } else {
    // default/relevance: status then posted_at
    query = query
      .order('status', { ascending: true })
      .order('posted_at', { ascending: false })
  }

  query = query.range(from, to)

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
 */
export async function getSearchStats(
  supabase: SupabaseClientType,
  filters: SearchFilters
): Promise<{ totalJobs: number; totalCompanies: number; newToday: number }> {
  const [compIds, tagOpps] = await Promise.all([
    getMatchingCompanyIds(supabase, filters.q),
    getMatchingTagOpps(supabase, filters.q),
  ])

  // Distinct company count
  let companyQuery = supabase
    .from('opportunities')
    .select('company_id')
    .in('status', ['Published', 'Closing Soon'])
    .not('company_id', 'is', null)

  companyQuery = applyAllFilters(companyQuery, filters, compIds, tagOpps)

  // New today count
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let newTodayQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .gte('posted_at', todayStart.toISOString())

  newTodayQuery = applyAllFilters(newTodayQuery, filters, compIds, tagOpps)

  const [companyResult, newTodayResult] = await Promise.all([
    companyQuery,
    newTodayQuery,
  ])

  // Count distinct companies manually
  const distinctCompanies = new Set(companyResult.data?.map((row: any) => row.company_id))

  return {
    totalJobs: 0, // Filled by caller from main query count
    totalCompanies: distinctCompanies.size,
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

async function getMatchingTagOpps(
  supabase: SupabaseClientType,
  q: string | undefined
): Promise<string[]> {
  if (!q || q.trim().length === 0) return []
  const { data: tags } = await supabase
    .from('opportunity_tags')
    .select('opportunity_id')
    .ilike('tag_name', `%${q.trim()}%`)
  return tags?.map((t) => t.opportunity_id) || []
}

function applyAllFilters(
  query: any,
  filters: SearchFilters,
  compIds: string[],
  tagOpps: string[]
) {
  let q = query

  // Search string application
  if (filters.q && filters.q.trim().length > 0) {
    const term = filters.q.trim()
    const safeQ = term.replace(/"/g, '""')
    const conditions = []
    
    conditions.push(`fts.plfts(english)."${safeQ}"`)
    conditions.push(`location.ilike.%${term}%`)
    conditions.push(`category.ilike.%${term}%`)
    
    if (compIds.length > 0) {
      conditions.push(`company_id.in.(${compIds.join(',')})`)
    }
    if (tagOpps.length > 0) {
      conditions.push(`id.in.(${tagOpps.join(',')})`)
    }
    
    q = q.or(conditions.join(','))
  }

  // Explicit filters
  if (filters.category && filters.category.length > 0) {
    q = q.in('category', filters.category)
  }

  if (filters.mode && filters.mode.length > 0) {
    q = q.in('mode', filters.mode)
  }

  if (filters.is_paid !== undefined) {
    q = q.eq('is_paid', filters.is_paid)
  }

  if (filters.experience_level && filters.experience_level.length > 0) {
    q = q.in('experience_level', filters.experience_level)
  }

  if (filters.fresh) {
    const interval = getFreshnessInterval(filters.fresh)
    if (interval) {
      const cutoff = new Date(Date.now() - interval)
      q = q.gte('posted_at', cutoff.toISOString())
    }
  }

  if (filters.deadline) {
    const interval = getDeadlineInterval(filters.deadline)
    if (interval) {
      const now = new Date()
      const cutoff = new Date(now.getTime() + interval)
      q = q.gte('deadline', now.toISOString()).lte('deadline', cutoff.toISOString())
    }
  }

  if (filters.location && filters.location.trim().length > 0) {
    q = q.ilike('location', `%${filters.location.trim()}%`)
  }

  return q
}
