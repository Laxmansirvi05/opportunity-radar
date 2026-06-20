import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { aiService } from '@/src/lib/resume-ai/service/ai.service'
import { resumeDataSchema } from '@/src/lib/resume-ai/schema/data'

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
    return NextResponse.json({ error: 'invalid file' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid file' }, { status: 400 })
  }

  // Validate MIME type
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'invalid file' }, { status: 422 })
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 422 })
  }

  // Validate magic bytes
  const buffer = await file.arrayBuffer()
  const header = String.fromCharCode(...new Uint8Array(buffer, 0, 5))
  if (!header.startsWith('%PDF')) {
    return NextResponse.json({ error: 'invalid file' }, { status: 422 })
  }

  // Generate unique storage path
  const timestamp = Date.now()
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${timestamp}_${safeFilename}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('[Upload] Storage error:', uploadError.message)
    return NextResponse.json({ error: 'storage failure' }, { status: 500 })
  }

  // Convert to Base64
  const base64Data = Buffer.from(buffer).toString('base64')

  try {
    // Parse using AI Service
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      await supabase.storage.from('resumes').remove([storagePath])
      return NextResponse.json(
        { error: 'Google Generative AI API key is missing. Pass it using the apiKey parameter or the GOOGLE_GENERATIVE_AI_API_KEY environment variable.' },
        { status: 500 }
      )
    }

    const rawParsedData = await aiService.parsePdf({
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      apiKey,
      baseURL: '',
      file: { name: file.name, data: base64Data },
    })

    // Validate using resumeDataSchema
    const parsedData = resumeDataSchema.parse(rawParsedData)

    // Save to database
    const { data: resumeRow, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_url: storagePath,
        file_name: file.name,
        parsed_data: parsedData,
        status: 'uploaded',
      })
      .select('id')
      .single()

    if (dbError || !resumeRow) {
      console.error('[Upload] DB insert error:', dbError?.message)
      await supabase.storage.from('resumes').remove([storagePath])
      return NextResponse.json({ error: 'database failure' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      resume_id: resumeRow.id,
      resume: parsedData,
    }, { status: 201 })
  } catch (error) {
    console.error('[Upload] AI parsing failure:', error)
    await supabase.storage.from('resumes').remove([storagePath])
    return NextResponse.json({ error: 'AI parsing failure' }, { status: 500 })
  }
}
