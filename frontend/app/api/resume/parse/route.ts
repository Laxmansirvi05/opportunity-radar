import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { extractTextFromPDF, validatePDFBuffer } from '@/lib/resume-parser/pdf-extractor'
import { callAI } from '@/lib/ai-gateway'
import { pdfParserSystemPrompt, pdfParserUserPrompt } from '@/features/resume-toolkit/services/ai/prompts'
import { sanitizeAndParseResumeJson } from '@/features/resume-toolkit/services/ai/sanitize'

/** Caught values are `unknown`; surface a message without assuming an Error. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}


// ---------------------------------------------------------------------------
// POST /api/resume/parse
// Parses an uploaded PDF and returns structured ResumeData json.
// This replaces the old OR async pipeline with RR's synchronous JSON extraction.
// ---------------------------------------------------------------------------
// Extracts text from an uploaded PDF and then runs it through the AI gateway
// to structure it — the same two-stage shape as
// /api/resume/optimization/extract, which carries 120 for exactly this
// reason. Neither stage is fast, and the default timeout would cut the parse
// off mid-run.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    // Auth is required unconditionally. This previously skipped the check
    // whenever NODE_ENV was not 'production', which made every preview
    // deployment an open, unmetered door to the AI providers — and the
    // 'dev-test-user' fallback below also bypassed per-user rate limits.
    if (!user) {
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
    const isPdf = file.type === 'application/pdf'
    const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Upload a PDF, PNG, JPEG, or WebP resume.' }, { status: 422 })
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 422 })
    }

    const buffer = await file.arrayBuffer()
    let rawText = ''
    if (isPdf) {
      const validation = validatePDFBuffer(buffer)
      if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 422 })
      try {
        rawText = await extractTextFromPDF(buffer)
      } catch {
        return NextResponse.json({ error: 'Failed to extract text from the PDF. The file may be corrupted or image-based.' }, { status: 422 })
      }
      if (rawText.trim().length < 50) {
        return NextResponse.json({ error: 'Could not extract enough text from the PDF. Try a text-based PDF.' }, { status: 422 })
      }
    }

    const parserValidator = (content: string) => {
      try {
        sanitizeAndParseResumeJson(content)
        return { valid: true as const }
      } catch (e: unknown) {
        return { valid: false as const, reason: `Sanitization Error: ${errorMessage(e)}` }
      }
    }

    // Generate AI JSON
    const aiResult = await callAI(
      {
        systemPrompt: pdfParserSystemPrompt,
        userPrompt:   isPdf
          ? `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`
          : 'Extract the attached resume image into the required JSON structure. Return only JSON.',
        maxTokens:    8000,
        temperature:  0.1,
        outputFormat: 'json',
        media: isImage ? { data: Buffer.from(buffer).toString('base64'), mimeType: file.type } : undefined,
      },
      { feature: 'resume_parser', userId: user.id, validator: parserValidator }
    )

    if (!aiResult.success) {
      let friendlyError = 'The AI was unable to process this resume.'
      if (aiResult.reason === 'rate_limit') friendlyError = 'AI generation rate limit exceeded. Please wait and try again.'
      else if (aiResult.reason === 'all_failed') friendlyError = 'All AI providers are currently unavailable. Please try again later.'
      else if (aiResult.reason === 'invalid_response') friendlyError = 'The AI returned an empty or invalid response.'
      else friendlyError = `AI parsing failed (${aiResult.reason}). Please try again.`

      return NextResponse.json({ error: friendlyError }, { status: 502 })
    }

    // Sanitize and Validate using RR logic
    try {
      const { data } = sanitizeAndParseResumeJson(aiResult.content)
      return NextResponse.json({ ...data, rawText })
    } catch (parseError: unknown) {
      console.error('[Parse] Sanitization failed:', parseError)
      return NextResponse.json({
        error: 'The AI returned an improperly formatted structure that could not be parsed.'
      }, { status: 400 })
    }

  } catch (error: unknown) {
    console.error('[Parse] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
