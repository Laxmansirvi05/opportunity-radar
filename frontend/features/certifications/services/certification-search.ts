import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeFilterTerm } from '@/features/opportunities/services/opportunity-service'
import type { Certification } from '../components/certifications-client'

export const SELECT_COLUMNS =
  'id, title, provider, provider_logo, certificate_image, description, url, is_free, price_label, level, duration, topics, has_certificate, link_status'

// Kept in sync with lib/certifications/get-catalogue.ts's DEAD_LINK_FILTER —
// duplicated rather than shared because one runs server-side (Next's
// unstable_cache can't be imported into client bundles) and one runs in the
// browser, but the filter string itself must stay identical.
const DEAD_LINK_FILTER = 'link_status.is.null,link_status.not.in.(0,404,410)'

export type PriceFilter = 'all' | 'free' | 'paid'

export interface CertificationQueryFilters {
  query: string
  price: PriceFilter
  levels: string[]
  providers: string[]
}

export interface CertificationPageResult {
  data: Certification[]
  /** Total rows matching the filter server-side, before any client-side
   *  duration-bucket refinement. Null on error. */
  count: number | null
}

function stripLinkStatus(c: Certification & { link_status: number | null }): Certification {
  return {
    id: c.id,
    title: c.title,
    provider: c.provider,
    provider_logo: c.provider_logo,
    certificate_image: c.certificate_image,
    description: c.description,
    url: c.url,
    is_free: c.is_free,
    price_label: c.price_label,
    level: c.level,
    duration: c.duration,
    topics: c.topics,
    has_certificate: c.has_certificate,
  }
}

/**
 * Fetches one page of the certifications catalogue matching the given
 * filters, run entirely server-side via Postgres (indexed columns +
 * `certifications.fts`'s GIN index) rather than shipping the whole ~13,000+
 * row catalogue to the browser to filter in memory — that approach produced
 * a ~10MB payload on every page load, which was the dominant cause of the
 * page feeling slow. RLS on `certifications` grants public SELECT, so this
 * is safe to call straight from the browser client like the existing
 * opportunities search does.
 *
 * Search matches the `fts` tsvector (title + provider + description + topics,
 * backed by `idx_certifications_fts`) so a term that only appears in a cert's
 * topics/description — e.g. searching "kubernetes" and surfacing an Azure
 * course that teaches it — is found, not just title/provider hits. The `fts`
 * branch is OR-ed with `title`/`provider` ilike so typing a partial word
 * ("kube") still matches as-you-type, which stemmed full-text alone would
 * not. Mirrors the opportunities search (opportunity-service.ts).
 *
 * Duration is NOT filtered here — there is no stored numeric/bucket column
 * for it (see features/certifications/lib/duration.ts) — callers apply that
 * client-side to whatever page comes back.
 */
export async function fetchCertificationsPage(
  supabase: SupabaseClient,
  filters: CertificationQueryFilters,
  offset: number,
  limit: number
): Promise<CertificationPageResult> {
  let q = supabase.from('certifications').select(SELECT_COLUMNS, { count: 'exact' }).or(DEAD_LINK_FILTER)

  const rawTerm = filters.query.trim()
  if (rawTerm) {
    // Full-text value is quoted inside the .or() expression, so doubling any
    // embedded quotes is enough there; the ilike patterns are unquoted and
    // cannot be escaped, so their separators are stripped by sanitizeFilterTerm.
    const safeQ = rawTerm.replace(/"/g, '""')
    const safeTerm = sanitizeFilterTerm(filters.query)
    const conditions = [`fts.plfts(english)."${safeQ}"`]
    if (safeTerm.length > 0) {
      conditions.push(`title.ilike.%${safeTerm}%`)
      conditions.push(`provider.ilike.%${safeTerm}%`)
    }
    q = q.or(conditions.join(','))
  }
  if (filters.price === 'free') q = q.eq('is_free', true)
  if (filters.price === 'paid') q = q.eq('is_free', false)
  if (filters.levels.length > 0) q = q.in('level', filters.levels)
  if (filters.providers.length > 0) q = q.in('provider', filters.providers)

  const { data, error, count } = await q
    .order('is_free', { ascending: false })
    .order('title', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[Certifications] search failed:', error.message)
    return { data: [], count: null }
  }
  const rows = (data ?? []) as (Certification & { link_status: number | null })[]
  return { data: rows.map(stripLinkStatus), count: count ?? null }
}
