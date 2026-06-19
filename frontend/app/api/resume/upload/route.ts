import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// POST /api/resume/upload
// Accepts a PDF file, validates it, uploads to Supabase Storage
// Returns: { resume_id, file_url }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  // Validate MIME type
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted.' }, { status: 422 })
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 422 })
  }

  // Validate magic bytes
  const buffer = await file.arrayBuffer()
  const header = String.fromCharCode(...new Uint8Array(buffer, 0, 5))
  if (!header.startsWith('%PDF')) {
    return NextResponse.json({ error: 'File is not a valid PDF.' }, { status: 422 })
  }

  // Generate unique storage path: {user_id}/{timestamp}_{filename}
  const timestamp = Date.now()
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${timestamp}_${safeFilename}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(storagePath, buffer, {
      contentType:  'application/pdf',
      cacheControl: '3600',
      upsert:       false,
    })

  if (uploadError) {
    console.error('[Upload] Storage error:', uploadError.message)
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }

  // Get the public/signed URL (private bucket = signed)
  const { data: signedUrlData } = await supabase.storage
    .from('resumes')
    .createSignedUrl(storagePath, 300)  // 5 min expiry for parse pipeline

  // Create resume row in DB (status: 'uploaded')
  const { data: resumeRow, error: dbError } = await supabase
    .from('resumes')
    .insert({
      user_id:   user.id,
      file_url:  storagePath,
      file_name: file.name,
      status:    'uploaded',
    })
    .select('id')
    .single()

  if (dbError || !resumeRow) {
    console.error('[Upload] DB insert error:', dbError?.message)
    // Attempt to clean up storage on DB failure
    await supabase.storage.from('resumes').remove([storagePath])
    return NextResponse.json({ error: 'Failed to record upload.' }, { status: 500 })
  }

  return NextResponse.json({
    resume_id:  resumeRow.id,
    file_url:   storagePath,
    signed_url: signedUrlData?.signedUrl ?? null,
  }, { status: 201 })
}
