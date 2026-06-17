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
  
  // Attempt to use the highly optimized RPC search first
  const rpcArgs = {
    search_query: filters.q?.trim() || null,
    filter_category: filters.category?.length ? filters.category : null,
    filter_mode: filters.mode?.length ? filters.mode : null,
    filter_is_paid: filters.is_paid !== undefined ? filters.is_paid : null,
    filter_location: filters.location?.trim() || null,
    filter_freshness_interval: (filters.fresh && getFreshnessInterval(filters.fresh)) ? `${getFreshnessInterval(filters.fresh)! / 1000} seconds` : null,
    filter_deadline_min: filters.deadline ? new Date().toISOString() : null,
    filter_deadline_max: filters.deadline && getDeadlineInterval(filters.deadline) ? new Date(Date.now() + getDeadlineInterval(filters.deadline)!).toISOString() : null,
    sort_by: filters.sort || 'relevance',
    page_offset: from,
    page_limit: PAGE_SIZE,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc('search_opportunities_rpc' as any, rpcArgs);

  if (!rpcError && rpcData) {
    // Transform RPC result to match the OpportunityWithDetails structure
    const formattedData = rpcData.map((row: any) => ({
      id: row.id,
      title: row.title,
      location: row.location,
      category: row.category,
      mode: row.mode,
      experience_level: row.experience_level,
      is_paid: row.is_paid,
      status: row.status,
      posted_at: row.posted_at,
      deadline: row.deadline,
      company_id: row.company_id,
      apply_url: row.apply_url,
      companies: {
        id: row.company_id,
        name: row.company_name,
        logo_url: row.company_logo_url,
        website_url: row.company_website_url,
      },
      opportunity_tags: row.tag_names?.map((t: string) => ({ tag_name: t })) || [],
    }));
    
    const count = rpcData.length > 0 ? Number(rpcData[0].total_count) : 0;
    return { data: formattedData as unknown as OpportunityWithDetails[], count };
  }

  if (rpcError && rpcError.code !== 'PGRST202') {
    // Only log if it's not a "function missing" error
    console.error('RPC Search error:', rpcError);
  }

  // FALLBACK: Old sequential OR-based search (if migration hasn't been applied yet)
  const [compIds, tagOpps] = await Promise.all([
    getMatchingCompanyIds(supabase, filters.q),
    getMatchingTagOpps(supabase, filters.q),
  ])

  let query = supabase
    .from('opportunities')
    .select(
      `
      id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url,
      companies (id, name, logo_url, website_url),
      opportunity_tags (tag_name)
    `,
      { count: 'exact' }
    )
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)

  query = applyAllFilters(query, filters, compIds, tagOpps)

  if (filters.sort === 'newest') {
    query = query.order('posted_at', { ascending: false })
  } else if (filters.sort === 'deadline') {
    query = query
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
  } else {
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
): Promise<{ totalJobs: number; totalCompanies: number; newToday: number; postedToday: number; importedToday: number }> {
  const [compIds, tagOpps] = await Promise.all([
    getMatchingCompanyIds(supabase, filters.q),
    getMatchingTagOpps(supabase, filters.q),
  ])

  // Distinct company count
  let companyQuery = supabase
    .from('opportunities')
    .select('company_id')
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .not('company_id', 'is', null)

  companyQuery = applyAllFilters(companyQuery, filters, compIds, tagOpps)

  // Posted today count
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let postedTodayQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .gte('posted_at', todayStart.toISOString())

  postedTodayQuery = applyAllFilters(postedTodayQuery, filters, compIds, tagOpps)

  // Imported today count
  let importedTodayQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .gte('ingested_at', todayStart.toISOString())

  importedTodayQuery = applyAllFilters(importedTodayQuery, filters, compIds, tagOpps)

  const [companyResult, postedTodayResult, importedTodayResult] = await Promise.all([
    companyQuery,
    postedTodayQuery,
    importedTodayQuery,
  ])

  // Count distinct companies manually
  const distinctCompanies = new Set(companyResult.data?.map((row: any) => row.company_id))

  return {
    totalJobs: 0, // Filled by caller from main query count
    totalCompanies: distinctCompanies.size,
    newToday: (postedTodayResult.count ?? 0) + (importedTodayResult.count ?? 0), // fallback/combined metric
    postedToday: postedTodayResult.count ?? 0,
    importedToday: importedTodayResult.count ?? 0,
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
    .limit(50)
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
    .limit(50)
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
