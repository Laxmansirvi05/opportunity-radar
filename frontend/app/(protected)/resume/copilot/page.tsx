import { Metadata } from 'next'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ResumeOptimizerDashboard } from '@/features/resume-toolkit/components/optimizer'

export const metadata: Metadata = {
  title: 'Resume Optimiser | Resume Toolkit',
  description: 'Your real ATS score against a job description, plus gap-derived suggestions and two downloadable resumes.',
}

/**
 * /resume/copilot page.
 * Wrapped in Suspense because useSearchParams() (resume preselection) requires it in Next.js App Router.
 */
export default function ResumeOptimiserPage() {
  return (
    <div className="flex-1 flex flex-col p-6 lg:p-[40px]">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        }
      >
        <ResumeOptimizerDashboard />
      </Suspense>
    </div>
  )
}
