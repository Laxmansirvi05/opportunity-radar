import { Metadata } from 'next'
import AtsCheckerClient from './AtsCheckerClient'

export const metadata: Metadata = {
  title: 'ATS Score Checker | Resume Toolkit',
}

export default function ATSPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-surface p-8">
      <h1 className="text-3xl font-bold text-on-background mb-2">ATS Score Checker</h1>
      <p className="text-on-surface-variant mb-6">
        Analyze your resume against a target job description for ATS compatibility.
      </p>
      <AtsCheckerClient />
    </div>
  )
}
