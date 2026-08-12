import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/resume/ats-history
// Lists the authenticated user's past ATS checks, newest first — the ATS
// Checker's counterpart to GET /api/resume/optimization, which already lists
// past Optimiser runs. Kept as a summary (score, job snippet, date) rather
// than the full stored report; the full report is fetched per-item via
// GET /api/resume/ats-history/[id] when the student actually reopens one.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('resume_ats_reports')
    .select('id, score, created_at, target_job_description, resumes!inner(user_id)')
    .eq('resumes.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[ATS History] failed to list reports', error)
    return NextResponse.json({ error: 'Could not load your ATS check history.' }, { status: 500 })
  }

  const reports = (data ?? []).map((r) => ({
    id: r.id as string,
    score: Math.round(r.score as number),
    createdAt: r.created_at as string,
    jobLabel: ((r.target_job_description as string | null) ?? '').trim().slice(0, 80) || 'Resume-only check',
  }))

  return NextResponse.json({ reports })
}
