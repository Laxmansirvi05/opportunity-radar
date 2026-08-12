import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/resume/ats-history/[id]
// Fetches one stored ATS report in full — report_data is exactly the same
// AtsCheckResponse shape a fresh POST /api/resume/ats-check returns, so the
// client can feed it straight into the same result view without a second
// rendering path for "reopened" vs "just analysed".
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
    .select('id, score, created_at, target_job_description, report_data')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'ATS report not found.' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    score: data.score,
    createdAt: data.created_at,
    jobDescription: data.target_job_description,
    report: data.report_data,
  })
}
