'use client'

import { useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { ResumePreviewModal } from './optimizer/resume-preview'
import type { ParsedResume } from '@/types/resume'

/** Preview + Download for the /resume home card's latest result — the
 *  student's most recent resume without navigating into the Optimiser or
 *  ATS Checker just to see or grab a copy of it. */
export function LatestAnalysisActions({
  resume,
  label,
  downloadHref,
}: {
  resume: ParsedResume | null
  label: string
  downloadHref: string
}) {
  const [previewing, setPreviewing] = useState(false)

  if (!resume) return null

  return (
    <>
      <button
        onClick={() => setPreviewing(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          height: '40px', padding: '0 20px',
          borderRadius: '8px', border: '1px solid #E2E8F0',
          backgroundColor: '#ffffff', color: '#191b23',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Eye className="h-4 w-4" />
        Preview resume
      </button>
      <a
        href={downloadHref}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          height: '40px', padding: '0 20px',
          borderRadius: '8px', border: '1px solid #E2E8F0',
          backgroundColor: '#ffffff', color: '#191b23',
          fontSize: '14px', fontWeight: 600, textDecoration: 'none',
        }}
      >
        <Download className="h-4 w-4" />
        Download PDF
      </a>
      {previewing && (
        <ResumePreviewModal
          resume={resume}
          label={label}
          downloadHref={downloadHref}
          onClose={() => setPreviewing(false)}
        />
      )}
    </>
  )
}
