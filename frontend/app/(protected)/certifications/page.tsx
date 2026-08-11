import { createClient } from '@/lib/supabase/server'
import { CertificationsClient, type Certification } from '@/features/certifications/components/certifications-client'

export const metadata = {
  title: 'Certifications | Opportunity Radar',
  description: 'Free and paid certifications you can start any time.',
}

const PAGE_SIZE = 1000
const SELECT_COLUMNS =
  'id, title, provider, provider_logo, certificate_image, description, url, is_free, price_label, level, duration, topics, has_certificate'

export default async function CertificationsPage() {
  const supabase = await createClient()

  // PostgREST caps any single response at its configured db-max-rows
  // (1000 here) regardless of a client-side .limit() above that — a plain
  // .limit(2000) silently truncated the catalogue to the first 1000 rows.
  // The client component filters over the full in-memory list rather than
  // paging server-side, so every row has to actually be fetched up front.
  // With 13,000+ rows now, fetching pages in parallel (once the total count
  // is known) instead of one sequential await per page keeps this fast.
  const { count } = await supabase.from('certifications').select('id', { count: 'exact', head: true })
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const pages = await Promise.all(
    Array.from({ length: totalPages }, (_, i) =>
      supabase
        .from('certifications')
        .select(SELECT_COLUMNS)
        .order('is_free', { ascending: false })
        .order('title', { ascending: true })
        .range(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1)
    )
  )

  const all: Certification[] = []
  for (const { data, error } of pages) {
    if (error) {
      // The table ships in its own migration; until that is applied the page
      // should explain itself rather than crash.
      console.error('[Certifications] query failed:', error.message)
      continue
    }
    if (data) all.push(...(data as Certification[]))
  }

  return <CertificationsClient initial={all} />
}
