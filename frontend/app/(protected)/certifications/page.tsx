import { createClient } from '@/lib/supabase/server'
import { CertificationsClient, type Certification } from '@/features/certifications/components/certifications-client'

export const metadata = {
  title: 'Certifications | Opportunity Radar',
  description: 'Free and paid certifications you can start any time.',
}

const PAGE_SIZE = 1000

export default async function CertificationsPage() {
  const supabase = await createClient()

  // PostgREST caps any single response at its configured db-max-rows
  // (1000 here) regardless of a client-side .limit() above that — a plain
  // .limit(2000) silently truncated the catalogue to the first 1000 rows.
  // The client component filters over the full in-memory list rather than
  // paging server-side, so every row has to actually be fetched up front.
  const all: Certification[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('certifications')
      .select('id, title, provider, provider_logo, description, url, is_free, price_label, level, duration, topics, has_certificate')
      .order('is_free', { ascending: false })
      .order('title', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      // The table ships in its own migration; until that is applied the page
      // should explain itself rather than crash.
      console.error('[Certifications] query failed:', error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as Certification[]))
    if (data.length < PAGE_SIZE) break
  }

  return <CertificationsClient initial={all} />
}
