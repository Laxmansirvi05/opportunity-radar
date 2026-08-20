import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderResumePdf } from '@/lib/resume-optimizer/pdf'
import { convertResumeDataToParsedResume, looksLikeParsedResume } from '@/lib/resume-optimizer/convert-resume-data'
import type { ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// GET /api/resume/[id]/download
// Streams a saved resume (Build from Scratch / Extract & Edit) as an
// ATS-safe PDF — the "Your Resumes" list and the /resume home card both
// previously had no way to get a saved resume out as a file without opening
// the full builder and using its own export.
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('resumes')
    .select('parsed_data')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data?.parsed_data) {
    return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
  }

  const raw = data.parsed_data as Record<string, unknown>
  const resume = looksLikeParsedResume(raw)
    ? (raw as unknown as ParsedResume)
    : convertResumeDataToParsedResume(raw)

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
