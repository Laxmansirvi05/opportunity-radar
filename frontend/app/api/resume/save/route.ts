import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ParsedResumeSchema } from '@/types/resume'
import { extractResumeSkills } from '@/types/resume'

// ---------------------------------------------------------------------------
// POST /api/resume/save
// Student has reviewed parsed data and confirms it (status → verified)
// Also populates denormalised extracted_skills and extracted_project_keywords
// Body: { resume_id, parsed_data, set_as_primary? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { resume_id?: string; parsed_data?: unknown; set_as_primary?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.resume_id) {
    return NextResponse.json({ error: 'resume_id is required.' }, { status: 422 })
  }

  // Validate the parsed_data structure
  const parseResult = ParsedResumeSchema.safeParse(body.parsed_data)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid resume data.', details: parseResult.error.issues },
      { status: 422 }
    )
  }

  // Ownership check
  const { data: resume, error: fetchError } = await supabase
    .from('resumes')
    .select('id, status')
    .eq('id', body.resume_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !resume) {
    return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
  }

  if (!['review_required', 'verified'].includes(resume.status)) {
    return NextResponse.json(
      { error: 'Resume must be in review_required or verified status to save.' },
      { status: 409 }
    )
  }

  // Compute denormalised skill arrays (Change 2 — runs at verify time)
  const { skills, projectKeywords } = extractResumeSkills(parseResult.data)

  // Update resume to verified with denormalised columns
  const { error: updateError } = await supabase
    .from('resumes')
    .update({
      parsed_data:                 parseResult.data,
      status:                      'verified',
      extracted_skills:            skills,
      extracted_project_keywords:  projectKeywords,
      resume_last_reviewed_at:     new Date().toISOString(),
      error_message:               null,
    })
    .eq('id', body.resume_id)

  if (updateError) {
    console.error('[Save] Update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save resume.' }, { status: 500 })
  }

  // Optionally set as primary resume on profile
  if (body.set_as_primary !== false) {
    await supabase
      .from('profiles')
      .update({ primary_resume_id: body.resume_id })
      .eq('id', user.id)
  }

  return NextResponse.json({
    resume_id:        body.resume_id,
    status:           'verified',
    extracted_skills: skills,
    extracted_project_keywords: projectKeywords,
  })
}
