import { Metadata } from 'next'
import { ResumeLayoutShell } from '@/features/resume-toolkit/components/resume-layout-shell'

export const metadata: Metadata = {
  title: 'Resume Toolkit | Opportunity Radar',
  description: 'AI-powered resume building and optimization workspace',
}

export default function ResumeToolkitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ResumeLayoutShell>{children}</ResumeLayoutShell>
}
