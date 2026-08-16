import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderResumePdf } from '@/lib/resume-optimizer/pdf'
import type { ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// GET /api/resume/optimization/[id]/download?variant=baseline|polished|target
// Streams the ATS-safe PDF for one of the run's resumes. 'baseline' is the
// original resume the run was scored against (always present); 'polished'
// and 'target' 404 rather than substituting the other variant if the
// requested one was never generated (e.g. the target resume before the
// checklist is confirmed).
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const variant = req.nextUrl.searchParams.get('variant')
  if (variant !== 'baseline' && variant !== 'polished' && variant !== 'target') {
    return NextResponse.json({ error: 'variant must be "baseline", "polished" or "target".' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: run, error } = await supabase
    .from('resume_optimizations')
    .select('source_resume, polished_resume, target_resume')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: 'Optimisation run not found.' }, { status: 404 })
  }

  const resume = (
    variant === 'baseline' ? run.source_resume : variant === 'polished' ? run.polished_resume : run.target_resume
  ) as ParsedResume | null
  if (!resume) {
    const reason =
      variant === 'target'
        ? 'The target resume is not ready yet — confirm every item on the checklist first.'
        : 'A polished resume was not generated for this run.'
    return NextResponse.json({ error: reason }, { status: 404 })
  }

  const buffer = await renderResumePdf(resume)
  const safeName = (resume.name || 'resume').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'
  const filename = `${safeName}-${variant}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
