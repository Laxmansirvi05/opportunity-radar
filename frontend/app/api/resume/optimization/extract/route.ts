import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromPDF, validatePDFBuffer } from '@/lib/resume-parser/pdf-extractor'
import { extractResumeFromText } from '@/lib/resume-optimizer/extract-resume'

// ---------------------------------------------------------------------------
// POST /api/resume/optimization/extract
// Parses an uploaded PDF directly into ParsedResume shape for the optimiser.
//
// Deliberately separate from /api/resume/parse (the Resume Builder's
// extractor, which targets a much larger, deeply-nested schema and is
// unreliable for this purpose — see lib/resume-optimizer/extract-resume.ts).
// ---------------------------------------------------------------------------
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Upload a PDF resume.' }, { status: 422 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 422 })
  }

  const buffer = await file.arrayBuffer()
  const validation = validatePDFBuffer(buffer)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  let rawText: string
  try {
    rawText = await extractTextFromPDF(buffer)
  } catch {
    return NextResponse.json({ error: 'Failed to extract text from the PDF. The file may be corrupted or image-based.' }, { status: 422 })
  }
  if (rawText.trim().length < 50) {
    return NextResponse.json({ error: 'Could not extract enough text from the PDF. Try a text-based PDF.' }, { status: 422 })
  }

  const result = await extractResumeFromText(rawText, user.id)
  if (!result.success || !result.resume) {
    return NextResponse.json({ error: result.error || 'Could not read this resume.' }, { status: 502 })
  }

  return NextResponse.json({ resume: result.resume })
}
