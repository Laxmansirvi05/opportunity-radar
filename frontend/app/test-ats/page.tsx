import { Suspense } from 'react'
import { AtsCheckerDashboard } from '@/features/resume-toolkit/components/ats-checker'

export default function TestATSPage() {
  return (
    <div className="container max-w-6xl py-8 mx-auto">
      <Suspense fallback={null}>
        <AtsCheckerDashboard />
      </Suspense>
    </div>
  )
}
