import { CertificationsClient } from '@/features/certifications/components/certifications-client'
import { getCertificationsFirstPage, getTopCertificationProviders } from '@/lib/certifications/get-catalogue'

export const metadata = {
  title: 'Certifications | Opportunity Radar',
  description: 'Free and paid certifications you can start any time.',
}

export default async function CertificationsPage() {
  // getCertificationsFirstPage() now throws on a real query failure instead
  // of returning a fake empty result (see lib/certifications/get-catalogue.ts)
  // — caught here so a transient DB error reads to the student as "couldn't
  // load, try again" rather than as "the catalogue is empty."
  let items: Awaited<ReturnType<typeof getCertificationsFirstPage>>['items'] = []
  let total = 0
  let loadError = false
  let topProviders: Awaited<ReturnType<typeof getTopCertificationProviders>> = []

  try {
    ;[{ items, total }, topProviders] = await Promise.all([
      getCertificationsFirstPage(),
      getTopCertificationProviders(),
    ])
  } catch (err) {
    console.error('[Certifications] page load failed:', err)
    loadError = true
  }

  return <CertificationsClient seed={items} seedTotal={total} topProviders={topProviders} loadError={loadError} />
}
