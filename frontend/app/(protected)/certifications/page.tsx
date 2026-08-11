import { CertificationsClient } from '@/features/certifications/components/certifications-client'
import { getCertificationsFirstPage, getTopCertificationProviders } from '@/lib/certifications/get-catalogue'

export const metadata = {
  title: 'Certifications | Opportunity Radar',
  description: 'Free and paid certifications you can start any time.',
}

export default async function CertificationsPage() {
  const [{ items, total }, topProviders] = await Promise.all([
    getCertificationsFirstPage(),
    getTopCertificationProviders(),
  ])

  return <CertificationsClient seed={items} seedTotal={total} topProviders={topProviders} />
}
