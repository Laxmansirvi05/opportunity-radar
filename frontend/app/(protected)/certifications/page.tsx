import { createClient } from '@/lib/supabase/server'
import { CertificationsClient, type Certification } from '@/features/certifications/components/certifications-client'

export const metadata = {
  title: 'Certifications | Opportunity Radar',
  description: 'Free and paid certifications you can start any time.',
}

export default async function CertificationsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('certifications')
    .select('id, title, provider, provider_logo, description, url, is_free, price_label, level, duration, topics, has_certificate')
    .order('is_free', { ascending: false })
    .order('title', { ascending: true })
    .limit(2000)

  if (error) {
    // The table ships in its own migration; until that is applied the page
    // should explain itself rather than crash.
    console.error('[Certifications] query failed:', error.message)
  }

  return <CertificationsClient initial={(data ?? []) as Certification[]} />
}
