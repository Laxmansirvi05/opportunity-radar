'use client'

import { use } from 'react'
import { ResumeBuilder } from '@/features/resume-toolkit/components/builder/resume-builder'

export default function EditResumePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  return <ResumeBuilder slug={slug} />
}
