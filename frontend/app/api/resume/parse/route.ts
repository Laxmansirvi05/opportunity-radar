import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseResume } from '@/lib/resume-parser/parser'

// ---------------------------------------------------------------------------
// POST /api/resume/parse
// Triggers AI parsing for an uploaded resume
// Rate: 5 parses/hour per user
// Body: { resume_id: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Body parsing
  let body: { resume_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.resume_id || typeof body.resume_id !== 'string') {
    return NextResponse.json({ error: 'resume_id is required.' }, { status: 422 })
  }

  // Fetch the resume row — ownership check via RLS
  const { data: resume, error: fetchError } = await supabase
    .from('resumes')
    .select('id, file_url, status, user_id')
    .eq('id', body.resume_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !resume) {
    return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
  }

  if (resume.status === 'parsing') {
    return NextResponse.json(
      { error: 'Resume is already being parsed.' },
      { status: 409 }
    )
  }

  // Mark as parsing
  await supabase
    .from('resumes')
    .update({ status: 'parsing' })
    .eq('id', resume.id)

  // Download the PDF from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('resumes')
    .download(resume.file_url)

  if (downloadError || !fileData) {
    await supabase
      .from('resumes')
      .update({ status: 'failed', error_message: 'File download failed.' })
      .eq('id', resume.id)
    return NextResponse.json({ error: 'Failed to retrieve PDF.' }, { status: 500 })
  }

  const buffer = await fileData.arrayBuffer()

  // Run parse pipeline
  const parseResult = await parseResume(buffer, user.id)

  if (!parseResult.success) {
    await supabase
      .from('resumes')
      .update({
        status:        'failed',
        error_message: parseResult.error,
      })
      .eq('id', resume.id)

    return NextResponse.json(
      { error: parseResult.error, stage: parseResult.stage },
      { status: 422 }
    )
  }

  // Save parsed data (status → review_required)
  const { error: saveError } = await supabase
    .from('resumes')
    .update({
      parsed_data:  parseResult.parsed,
      status:       'review_required',
      error_message: null,
    })
    .eq('id', resume.id)

  if (saveError) {
    console.error('[Parse] DB save error:', saveError.message)
    return NextResponse.json({ error: 'Failed to save parsed data.' }, { status: 500 })
  }

  return NextResponse.json({
    resume_id:   resume.id,
    status:      'review_required',
    parsed_data: parseResult.parsed,
  })
}
