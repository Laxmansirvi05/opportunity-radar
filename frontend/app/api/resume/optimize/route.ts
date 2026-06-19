import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { optimiseBullet }           from '@/lib/resume-optimizer'
import { OptimizerRequestSchema }   from '@/lib/resume-optimizer/types'

// ---------------------------------------------------------------------------
// POST /api/resume/optimize
// Generate 3 STAR-format bullet alternatives for a single experience bullet
// Rate: 20 calls/user/day (enforced by AI Gateway via ai_usage_log)
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = OptimizerRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.issues },
      { status: 422 }
    )
  }

  const { resume_id, opportunity_id, bullet_text, target_skill } = parsed.data

  // Ownership check on resume
  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id')
    .eq('id', resume_id)
    .eq('user_id', user.id)
    .eq('status', 'verified')
    .single()

  if (resumeError || !resume) {
    return NextResponse.json(
      { error: 'Verified resume not found.' },
      { status: 404 }
    )
  }

  // Fetch opportunity title + company for context
  const { data: opp } = await supabase
    .from('opportunities')
    .select('title, company_id')
    .eq('id', opportunity_id)
    .single()

  const result = await optimiseBullet({
    originalBullet:   bullet_text,
    opportunityTitle: opp?.title ?? 'This Role',
    companyName:      'the company',  // Company name fetched separately if needed
    targetSkill:      target_skill ?? null,
    userId:           user.id,
    opportunityId:    opportunity_id,
  })

  if (!result.success) {
    const status = result.error.includes('rate limit') ? 429 : 503
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result.result)
}
