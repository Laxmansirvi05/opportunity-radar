import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { callAI } from '@/lib/ai-gateway'
import { buildJDExtractionPrompt, buildAtsCoachingPrompt } from '@/features/resume-toolkit/services/ai/ats-prompts'
import { atsCheckResponseSchema, atsCoachingSchema, jdExtractionSchema } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import { calculateAtsReadiness } from '@/lib/ats-checker/readiness'
import { calculateJobMatch } from '@/lib/ats-checker/job-match'
import { extractJDIntelligence, evaluateResumeEvidence } from '@/features/resume-toolkit/services/ai/ats-v2-intelligence'
import { calculateAtsV2Score } from '@/lib/ats-checker/scoring-v2'
import { jsonrepair } from 'jsonrepair'
import type { ParsedResume } from '@/types/resume'

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 })
    }

    const { resumeId, resumeData, jobDescription, companyName, targetRole, jobUrl } = body as {
      resumeId?: string
      resumeData?: ParsedResume
      jobDescription?: string
      companyName?: string
      targetRole?: string
      jobUrl?: string
    }

    if (!jobDescription || jobDescription.trim().length < 100) {
      return NextResponse.json({ error: 'Please paste the full job description so we can calculate an accurate targeted match.' }, { status: 400 })
    }

    if (!targetRole || targetRole.trim().length === 0) {
      return NextResponse.json({ error: 'Target role is required.' }, { status: 400 })
    }

    if (!companyName || companyName.trim().length === 0) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
    }

    if (jobUrl && jobUrl.trim().length > 0) {
      try {
        new URL(jobUrl.trim())
      } catch {
        return NextResponse.json({ error: 'Invalid Job URL.' }, { status: 400 })
      }
    }

    let parsedResumeData: ParsedResume | null = null

    if (resumeId) {
      const { data: resume, error: dbError } = await supabase
        .from('resumes')
        .select('id, parsed_data')
        .eq('id', resumeId)
        .single()

      if (dbError || !resume || !resume.parsed_data) {
        return NextResponse.json({ error: 'Saved Resume not found or unparsed.' }, { status: 404 })
      }
      parsedResumeData = resume.parsed_data as any
    } else if (resumeData) {
      parsedResumeData = resumeData
    } else {
      return NextResponse.json({ error: 'Must provide either resumeId or resumeData.' }, { status: 400 })
    }

    if (!parsedResumeData) {
      return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 })
    }

    const { normalizeToAtsResume } = await import('@/lib/ats-checker/normalization')
    const normalizedResume = normalizeToAtsResume(parsedResumeData)

    // 1. DETERMINISTIC ATS READINESS (Used internally for Structure points & coaching)
    const readiness = calculateAtsReadiness(normalizedResume as any)

    let jobMatchResult = undefined
    let coachingResult = undefined
    let aiFailed = false
    let jdExtraction = undefined
    let atsV2Data = undefined

    // 2. TARGETED JOB MATCH
    // Step 2A: Extract JD Requirements via AI
    const { systemPrompt: jdSys, userPrompt: jdUser } = buildJDExtractionPrompt(jobDescription, companyName, targetRole)

    const jdAiResult = await callAI(
      { systemPrompt: jdSys, userPrompt: jdUser, maxTokens: 2000, temperature: 0.1, outputFormat: 'json' },
      { feature: 'resume_ats_jd_extract', userId: user.id }
    )

    if (jdAiResult.success) {
      try {
        const parsedJd = JSON.parse(jsonrepair(jdAiResult.content))
        jdExtraction = jdExtractionSchema.parse(parsedJd)

        // Step 2B: DETERMINISTIC Job Match (V3 Engine)
        jobMatchResult = calculateJobMatch(normalizedResume as any, jdExtraction)

        // Step 2C: AI Coaching Feedback
        const { systemPrompt: coachSys, userPrompt: coachUser } = buildAtsCoachingPrompt(
          normalizedResume as any,
          readiness,
          jobMatchResult,
          jdExtraction
        )

        const coachAiResult = await callAI(
          { systemPrompt: coachSys, userPrompt: coachUser, maxTokens: 2000, temperature: 0.3, outputFormat: 'json' },
          { feature: 'resume_ats_coaching', userId: user.id }
        )

        if (coachAiResult.success) {
          const parsedCoach = JSON.parse(jsonrepair(coachAiResult.content))
          coachingResult = atsCoachingSchema.parse(parsedCoach)
        } else {
          aiFailed = true
        }

        // Step 2D: ATS V2 Intelligence Pipeline
        const v2JdRes = await extractJDIntelligence(jobDescription, companyName, targetRole, user.id)
        if (v2JdRes.success && v2JdRes.data) {
          const v2EvalRes = await evaluateResumeEvidence(parsedResumeData, v2JdRes.data, user.id)
          if (v2EvalRes.success && v2EvalRes.data) {
            const v2Score = calculateAtsV2Score(v2JdRes.data, v2EvalRes.data, parsedResumeData)
            atsV2Data = {
              score: v2Score,
              evidenceMatrix: v2EvalRes.data,
              structuredJd: v2JdRes.data,
            }
          }
        }
      } catch (e) {
        console.error('[ATS] AI parsing or validation error:', e)
        aiFailed = true
      }
    } else {
      aiFailed = true
    }

    const finalResponse = atsCheckResponseSchema.parse({
      readiness,
      jobMatch: jobMatchResult,
      coaching: coachingResult,
      aiFailed,
      atsV2: atsV2Data,
    })

    // Store in DB only if this is a saved resume
    if (resumeId) {
      const { error: insertError } = await supabase.from('resume_ats_reports').insert({
        resume_id: resumeId,
        target_job_description: jobDescription.slice(0, 5000),
        score: jobMatchResult ? jobMatchResult.score : readiness.score,
        report_data: finalResponse as any,
      })

      if (insertError) {
        console.error('[ATS] Failed to store report', insertError)
      }
    }

    return NextResponse.json(finalResponse)
  } catch (error: unknown) {
    console.error('[ATS] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
