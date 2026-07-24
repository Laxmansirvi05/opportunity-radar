import { Metadata } from 'next'
import { AtsCheckerDashboard } from '@/features/resume-toolkit/components/ats-checker'

export const metadata: Metadata = {
  title: 'ATS Score Checker | Opportunity Radar',
  description: 'Evaluate your resume for ATS readability and job match score.',
}

export default function ATSPage() {
  return (
    <div className="container max-w-6xl py-8 md:py-12 mx-auto">
      <AtsCheckerDashboard />
    </div>
  )
}
