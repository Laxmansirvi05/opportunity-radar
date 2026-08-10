import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOptimizationRun } from '@/lib/resume-optimizer/run'
import type { ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// POST /api/resume/optimization
// Starts a full optimisation run: baseline score, tier, suggestions, and a
// scored polished resume where the tier calls for one. Persisted so the run
// survives logout.
//
// GET /api/resume/optimization
// Lists the authenticated user's past runs, newest first.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Missing request body' }, { status: 400 })
  }

  const { resumeId, resumeData, jobDescription, companyName, targetRole } = body as {
    resumeId?: string
    resumeData?: ParsedResume
    jobDescription?: string
    companyName?: string
    targetRole?: string
  }

  if (!jobDescription || jobDescription.trim().length < 100) {
    return NextResponse.json(
      { error: 'Please paste the full job description so we can calculate an accurate score.' },
      { status: 400 }
    )
  }
  if (!targetRole || targetRole.trim().length === 0) {
    return NextResponse.json({ error: 'Target role is required.' }, { status: 400 })
  }
  if (!companyName || companyName.trim().length === 0) {
    return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
  }

  let resume: ParsedResume | null = null
  let originalResumeId: string | null = null

  if (resumeId) {
    const { data, error } = await supabase
      .from('resumes')
      .select('id, parsed_data')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single()

    if (error || !data?.parsed_data) {
      return NextResponse.json({ error: 'Resume not found, or has not finished parsing yet.' }, { status: 404 })
    }
    resume = data.parsed_data as ParsedResume
    originalResumeId = data.id
  } else if (resumeData) {
    resume = resumeData
  } else {
    return NextResponse.json({ error: 'Must provide either resumeId or resumeData.' }, { status: 400 })
  }

  const trimmedRole = targetRole.trim()
  const trimmedCompany = companyName.trim()

  const outcome = await startOptimizationRun({
    resume,
    jobDescription,
    targetRole: trimmedRole,
    companyName: trimmedCompany,
    userId: user.id,
  })

  if (!outcome.success) {
    return NextResponse.json({ error: outcome.error }, { status: 502 })
  }

  const { result } = outcome

  const { data: run, error: insertError } = await supabase
    .from('resume_optimizations')
    .insert({
      user_id: user.id,
      original_resume_id: originalResumeId,
      source_resume: resume,
      job_description: jobDescription,
      company_name: trimmedCompany,
      target_role: trimmedRole,
      baseline_score: result.baselineScore,
      baseline_report: result.baselineReport,
      tier: result.tier,
      suggestions: result.suggestions,
      polished_resume: result.polishedResume ?? null,
      polished_score: result.polishedScore ?? null,
    })
    .select()
    .single()

  if (insertError || !run) {
    console.error('[Optimizer] failed to persist run', insertError)
    return NextResponse.json(
      { error: 'Your resume was scored, but we could not save the run. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ run, warning: result.warning ?? null })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('resume_optimizations')
    .select('id, target_role, company_name, baseline_score, tier, polished_score, target_score, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Optimizer] failed to list runs', error)
    return NextResponse.json({ error: 'Could not load your optimisation runs.' }, { status: 500 })
  }

  return NextResponse.json({ runs: data ?? [] })
}
