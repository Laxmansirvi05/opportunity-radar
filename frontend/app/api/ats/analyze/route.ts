import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { runATSEngine, buildATSFallback } from '@/lib/ats-engine'
import { ATSAnalyzeQuerySchema }          from '@/types/ats'
import type { ParsedResume }              from '@/types/resume'

// ---------------------------------------------------------------------------
// GET /api/ats/analyze?opportunity_id=<uuid>
// Returns complete ATS analysis for the current user + a specific opportunity
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
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

  // Validate query param
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const query  = ATSAnalyzeQuerySchema.safeParse(params)
  if (!query.success) {
    return NextResponse.json(
      { error: 'opportunity_id must be a valid UUID.' },
      { status: 422 }
    )
  }

  const { opportunity_id } = query.data

  // Fetch student inputs and opportunity in parallel
  const [studentRes, oppRes, freqRes] = await Promise.all([
    supabase
      .from('v_student_ats_inputs')
      .select('extracted_skills, extracted_project_keywords, experience_json, education_json')
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('opportunities')
      .select('id, title, extracted_skills, experience_level')
      .eq('id', opportunity_id)
      .single(),

    supabase
      .from('skill_frequency_index')
      .select('skill, frequency'),
  ])

  // Opportunity not found
  if (oppRes.error || !oppRes.data) {
    return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })
  }

  // No verified resume → return fallback
  if (studentRes.error || !studentRes.data) {
    return NextResponse.json(buildATSFallback(), { status: 200 })
  }

  const student    = studentRes.data
  const opp        = oppRes.data

  // Build frequency map from DB rows
  const frequencyMap = new Map<string, number>(
    (freqRes.data ?? []).map((row: { skill: string; frequency: number }) => [row.skill, row.frequency])
  )

  // Reconstruct ParsedResume for experience/education scoring
  // (Only experience + education arrays are needed; skills come from denormalised columns)
  const partialResume: ParsedResume = {
    name:       '',
    skills:     student.extracted_skills,
    projects:   [],
    experience: (student.experience_json as ParsedResume['experience']) ?? [],
    education:  (student.education_json  as ParsedResume['education'])  ?? [],
  }

  // Run deterministic ATS Engine (pure TypeScript, no AI, no DB writes)
  const result = runATSEngine(
    partialResume,
    student.extracted_skills,
    student.extracted_project_keywords,
    opp,
    frequencyMap
  )

  return NextResponse.json(result, {
    headers: {
      // Client-side cache: 5 minutes. Invalidated when resume is re-verified.
      'Cache-Control': 'private, max-age=300',
    },
  })
}
