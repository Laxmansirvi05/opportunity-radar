import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import type { Certification } from '@/features/certifications/components/certifications-client'

export const SELECT_COLUMNS =
  'id, title, provider, provider_logo, certificate_image, description, url, is_free, price_label, level, duration, topics, has_certificate, link_status'

// Statuses the link-health cron (certification-link-sweep) treats as
// unambiguously dead — see lib/ingestion/link-checker.ts. Certifications are
// never deleted on a schedule, so a dead row stays in the table for a human
// to review; this is just what keeps it out of what students are shown. Any
// query against the table (this file or certification-search.ts) applies it.
export const DEAD_LINK_FILTER = 'link_status.is.null,link_status.not.in.(0,404,410)'

function anonClient() {
  // A plain anon client, not the cookie-bound SSR client — the catalogue is
  // public data (RLS: "Anyone can view certifications" USING TRUE) and has
  // nothing to do with the signed-in user, so it must not depend on request
  // cookies. Depending on cookies would force these calls to opt out of
  // Next's dynamic-render cache, defeating the point of caching them at all.
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
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

const FIRST_PAGE_SIZE = 48

/**
 * The very first screen of the catalogue (default sort, no filters) — small
 * enough (tens of KB, not the ~10MB the full 13,000+ row catalogue serializes
 * to) to genuinely fit Next's 2MB Data Cache item limit, so this actually
 * gets cached rather than silently failing to. Every subsequent page (search,
 * filters, or just scrolling further) is fetched live from the client via
 * certification-search.ts — see that file for why shipping the whole
 * catalogue up front was the wrong fix even though it made local search feel
 * "instant": it made the page itself slow to load for everyone, every time.
 */
async function fetchFirstPage(): Promise<{ items: Certification[]; total: number }> {
  const supabase = anonClient()
  const { data, error, count } = await supabase
    .from('certifications')
    .select(SELECT_COLUMNS, { count: 'exact' })
    .or(DEAD_LINK_FILTER)
    .order('is_free', { ascending: false })
    .order('title', { ascending: true })
    .order('id', { ascending: true })
    .range(0, FIRST_PAGE_SIZE - 1)

  if (error) {
    console.error('[Certifications] first-page query failed:', error.message)
    return { items: [], total: 0 }
  }
  const rows = (data ?? []) as (Certification & { link_status: number | null })[]
  return { items: rows.map(stripLinkStatus), total: count ?? 0 }
}

export const getCertificationsFirstPage = unstable_cache(fetchFirstPage, ['certifications-first-page-v2'], {
  revalidate: 900,
})

/**
 * Provider checklist for the filters sidebar. PostgREST has no GROUP BY over
 * the fluent client, so this counts in JS — but only the `provider` column
 * is selected, so even across 13,000+ rows the payload is small enough to
 * cache safely (well under the 2MB limit that broke the old full-row fetch).
 */
async function fetchTopProviders(): Promise<[string, number][]> {
  const supabase = anonClient()
  const pageSize = 1000
  const { count } = await supabase.from('certifications').select('id', { count: 'exact', head: true })
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize))

  const pages = await Promise.all(
    Array.from({ length: totalPages }, (_, i) =>
      supabase
        .from('certifications')
        .select('provider')
        .or(DEAD_LINK_FILTER)
        .order('id', { ascending: true })
        .range(i * pageSize, i * pageSize + pageSize - 1)
    )
  )

  const counts = new Map<string, number>()
  for (const { data, error } of pages) {
    if (error) continue
    for (const row of (data ?? []) as { provider: string }[]) {
      counts.set(row.provider, (counts.get(row.provider) ?? 0) + 1)
    }
  }
  // Shown in full in the sidebar with no inner scroll, so this is a real cap
  // on how many checkboxes render, not just a "top N" preview.
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24)
}

export const getTopCertificationProviders = unstable_cache(fetchTopProviders, ['certifications-top-providers-v1'], {
  revalidate: 3600,
})
