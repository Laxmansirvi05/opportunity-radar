import { Metadata } from 'next'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { AtsCheckerDashboard } from '@/features/resume-toolkit/components/ats-checker'

export const metadata: Metadata = {
  title: 'ATS Score Checker | Opportunity Radar',
  description: 'Evaluate your resume for ATS readability and job match score.',
}

// Wrapped in Suspense because useSearchParams() (reopening a past report via
// ?reportId=) requires it in Next.js App Router.
export default function ATSPage() {
  return (
    <div className="container max-w-6xl py-8 md:py-12 mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        }
      >
        <AtsCheckerDashboard />
      </Suspense>
    </div>
  )
}
