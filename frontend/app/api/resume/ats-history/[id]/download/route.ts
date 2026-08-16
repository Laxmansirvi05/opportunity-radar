import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderResumePdf } from '@/lib/resume-optimizer/pdf'
import type { ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// GET /api/resume/ats-history/[id]/download
// Streams the exact resume snapshot an ATS check was run against — works
// even for a check run via "Upload PDF" with no saved resume row, since the
// full ParsedResume is snapshotted inline on every report.
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('resume_ats_reports')
    .select('source_resume')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data?.source_resume) {
    return NextResponse.json({ error: 'ATS report not found.' }, { status: 404 })
  }

  const resume = data.source_resume as ParsedResume
  const buffer = await renderResumePdf(resume)
  const safeName = (resume.name || 'resume').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Content-Length': String(buffer.length),
    },
  })
}
