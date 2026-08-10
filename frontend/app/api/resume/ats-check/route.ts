import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { callAI } from '@/lib/ai-gateway'
import { buildAtsCoachingPrompt } from '@/features/resume-toolkit/services/ai/ats-prompts'
import { atsCheckResponseSchema, atsCoachingSchema } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import type { AnalysisError, AtsV2Score } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import { calculateAtsReadiness } from '@/lib/ats-checker/readiness'
import { extractJDIntelligence, evaluateResumeEvidence } from '@/features/resume-toolkit/services/ai/ats-v2-intelligence'
import { calculateAtsV2Score } from '@/lib/ats-checker/scoring-v2'
import { deriveSuggestions } from '@/lib/ats-checker/gap-suggestions'
import { computeAcademicRecommendation } from '@/lib/ats-checker/academic-recommendation'
import { convertResumeDataToParsedResume, looksLikeParsedResume } from '@/lib/resume-optimizer/convert-resume-data'
import { jsonrepair } from 'jsonrepair'
import type { ParsedResume } from '@/types/resume'

// Targeted mode makes up to 3 sequential AI-gateway calls (JD extraction,
// evidence evaluation, coaching narration), each with its own multi-provider
// fallback chain — the same shape of workload that previously needed an
// explicit maxDuration on /api/resume/optimization after that route was
// found being killed by Vercel's default timeout mid-pipeline, silently
// failing every run. This route had no override at all.
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    // Auth is required unconditionally. This previously skipped the check
    // whenever NODE_ENV was not 'production', which made every preview
    // deployment an open, unmetered door to the AI providers — and the
    // 'dev-test-user' fallback below also bypassed per-user rate limits.
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

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

    // A job description is now optional: providing one runs a targeted match
    // against it; omitting one runs a resume-only readiness check instead.
    // These are two distinct, clearly-labeled modes (see `mode` in the
    // response) rather than one mode silently degrading into the other.
    const trimmedJd = (jobDescription ?? '').trim()
    const hasJd = trimmedJd.length > 0

    if (hasJd && trimmedJd.length < 100) {
      return NextResponse.json({ error: 'Please paste the full job description so we can calculate an accurate targeted match.' }, { status: 400 })
    }

    if (hasJd && (!targetRole || targetRole.trim().length === 0)) {
      return NextResponse.json({ error: 'Target role is required.' }, { status: 400 })
    }

    if (hasJd && (!companyName || companyName.trim().length === 0)) {
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

    if (resumeId === 'sample-frontend-dev') {
      parsedResumeData = {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123-456-7890",
        summary: "Passionate Frontend Engineer with 3+ years of experience building modern web applications using React, TypeScript, HTML, CSS, Git, and REST APIs.",
        skills: ["JavaScript", "TypeScript", "React", "HTML", "CSS", "Git", "REST APIs", "Tailwind CSS"],
        experience: [
          {
            company: "Tech Solutions",
            role: "Frontend Developer Intern",
            start_date: "2023-01",
            end_date: "2023-12",
            bullets: [
              "Developed responsive web interfaces with React and TypeScript.",
              "Integrated REST APIs to fetch real-time application data.",
              "Collaborated using Git version control and code reviews."
            ]
          }
        ],
        education: [
          {
            institution: "State University",
            degree: "B.S.",
            degree_level: "bachelors",
            field: "Computer Science",
            graduation_year: 2024
          }
        ],
        projects: [
          {
            name: "E-Commerce Frontend",
            description: "Built responsive Next.js storefront using Tailwind CSS and React.",
            technologies: ["React", "Next.js", "Tailwind CSS"]
          }
        ]
      }
    } else if (resumeId) {
      const { data: resume, error: dbError } = await supabase
        .from('resumes')
        .select('id, parsed_data')
        .eq('id', resumeId)
        .single()

      if (dbError || !resume || !resume.parsed_data) {
        return NextResponse.json({ error: 'Saved Resume not found or unparsed.' }, { status: 404 })
      }
      // resumes.parsed_data is stored in the Resume Builder's shape (basics /
      // sections.*.items[]), not the flat ParsedResume shape every scoring
      // engine below reads. Casting it directly used to hand the AI an
      // object with name/skills/experience all undefined — every
      // requirement then read as unmet regardless of what the student
      // actually wrote. Same conversion the Optimiser uses, so both
      // features read a saved resume identically.
      const rawSaved = resume.parsed_data as Record<string, unknown>
      parsedResumeData = looksLikeParsedResume(rawSaved)
        ? (rawSaved as unknown as ParsedResume)
        : convertResumeDataToParsedResume(rawSaved)
    } else if (resumeData) {
      // The upload path now sources this from /api/resume/optimization/extract,
      // which already returns the flat ParsedResume shape — but guard the
      // conversion anyway in case a client sends the older Builder shape.
      const rawUploaded = resumeData as unknown as Record<string, unknown>
      parsedResumeData = looksLikeParsedResume(rawUploaded)
        ? resumeData
        : convertResumeDataToParsedResume(rawUploaded)
    } else {
      return NextResponse.json({ error: 'Must provide either resumeId or resumeData.' }, { status: 400 })
    }

    if (!parsedResumeData) {
      return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 })
    }

    const { normalizeToAtsResume } = await import('@/lib/ats-checker/normalization')
    const normalizedResume = normalizeToAtsResume(parsedResumeData)

    // Deterministic, JD-independent — always computed regardless of mode.
    const readiness = calculateAtsReadiness(normalizedResume as any)
    const academicRecommendation = computeAcademicRecommendation(parsedResumeData.education)

    if (!hasJd) {
      const finalResponse = atsCheckResponseSchema.parse({
        mode: 'resume_only',
        readiness,
        suggestions: [],
        academicRecommendation,
        analysisError: null,
        aiFailed: false,
      })

      if (resumeId && resumeId !== 'sample-frontend-dev') {
        const { error: insertError } = await supabase.from('resume_ats_reports').insert({
          resume_id: resumeId,
          target_job_description: null,
          score: readiness.score,
          report_data: finalResponse as any,
        })
        if (insertError) {
          console.error('[ATS] Failed to store resume-only report', insertError)
        }
      }

      return NextResponse.json(finalResponse)
    }

    // ── Targeted mode: the single V2 engine — AI extracts structure and
    // evidence, calculateAtsV2Score computes the final number. On failure,
    // record exactly which stage failed and why, rather than one generic
    // message regardless of cause.
    let atsV2Data: { score: AtsV2Score; evidenceMatrix: EvidenceMatrix; structuredJd: StructuredJD } | undefined
    let analysisError: AnalysisError | null = null

    try {
      const jdRes = await extractJDIntelligence(trimmedJd, companyName, targetRole, userId)
      if (!jdRes.success || !jdRes.data) {
        analysisError = {
          stage: 'jd_extraction',
          message: jdRes.error || 'Could not extract structured requirements from the job description.',
        }
      } else {
        const evalRes = await evaluateResumeEvidence(parsedResumeData, jdRes.data, userId)
        if (!evalRes.success || !evalRes.data) {
          analysisError = {
            stage: 'evidence_evaluation',
            message: evalRes.error || 'Could not evaluate the resume against the extracted requirements.',
          }
        } else {
          const score = calculateAtsV2Score(jdRes.data, evalRes.data, parsedResumeData)
          atsV2Data = { score, evidenceMatrix: evalRes.data, structuredJd: jdRes.data }
        }
      }
    } catch (e) {
      console.error('[ATS] V2 pipeline exception:', e)
      analysisError = {
        stage: 'unexpected',
        message: e instanceof Error ? e.message : 'An unexpected error occurred during analysis.',
      }
    }

    let suggestions: ReturnType<typeof deriveSuggestions> = []
    let coaching: { recruiterVerdict: string; powerWords: string[] } | undefined

    if (atsV2Data) {
      // Canonical gap checklist — the same deriver the Optimiser uses, so the
      // two features never show two different sets of gaps for one analysis.
      suggestions = deriveSuggestions(atsV2Data.structuredJd, atsV2Data.evidenceMatrix)

      // Qualitative narration only, grounded in the already-final V2 result.
      const { systemPrompt, userPrompt } = buildAtsCoachingPrompt(
        parsedResumeData,
        atsV2Data.structuredJd,
        atsV2Data.evidenceMatrix,
        atsV2Data.score
      )
      const coachValidator = (content: string) => {
        try {
          const repaired = jsonrepair(content)
          atsCoachingSchema.parse(JSON.parse(repaired))
          return { valid: true as const }
        } catch (e: any) {
          return { valid: false as const, reason: e.message }
        }
      }

      const coachAiResult = await callAI(
        { systemPrompt, userPrompt, maxTokens: 800, temperature: 0.4, outputFormat: 'json' },
        { feature: 'resume_ats_coaching', userId, validator: coachValidator }
      )

      if (coachAiResult.success) {
        try {
          coaching = atsCoachingSchema.parse(JSON.parse(jsonrepair(coachAiResult.content)))
        } catch (e) {
          console.error('[ATS] Coaching narration parse error:', e)
        }
      }
      // If narration fails, `coaching` stays undefined and the UI simply
      // omits the recruiter-verdict card — no fabricated fallback text
      // standing in for something the AI didn't actually say.
    }

    const finalResponse = atsCheckResponseSchema.parse({
      mode: 'targeted',
      readiness,
      atsV2: atsV2Data,
      coaching,
      suggestions,
      academicRecommendation,
      analysisError,
      aiFailed: Boolean(analysisError),
    })

    if (resumeId && resumeId !== 'sample-frontend-dev') {
      const { error: insertError } = await supabase.from('resume_ats_reports').insert({
        resume_id: resumeId,
        target_job_description: jobDescription!.slice(0, 5000),
        // Always the same score the response actually carries — never a
        // second engine's number diverging from what's shown on screen.
        score: atsV2Data ? atsV2Data.score.overallScore : readiness.score,
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
