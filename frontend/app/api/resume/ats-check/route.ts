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
    if (!user && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user?.id || 'dev-test-user'

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

    // Helper to normalize legacy JD extraction safely
    const normalizeLegacyJd = (parsed: any) => {
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON')
      const hardReqs = Array.isArray(parsed.hardRequirements)
        ? parsed.hardRequirements.map((h: any) => ({
            rule: typeof h === 'string' ? h : h?.rule || String(h),
            type: h?.type === 'Eligibility' ? 'Eligibility' : 'Required',
          }))
        : []
      let edu = String(parsed.educationRequirements || 'none').toLowerCase()
      if (edu.includes('bachelor')) edu = 'bachelors'
      else if (edu.includes('master')) edu = 'masters'
      else if (edu.includes('doctor') || edu.includes('phd')) edu = 'doctorate'
      else if (edu.includes('diploma')) edu = 'diploma'
      else if (!['doctorate', 'masters', 'bachelors', 'diploma', 'other', 'none'].includes(edu)) {
        edu = 'other'
      }
      return jdExtractionSchema.parse({
        targetRole: String(parsed.targetRole || targetRole || 'Target Role'),
        company: parsed.company ? String(parsed.company) : companyName,
        roleFamily: String(parsed.roleFamily || 'General'),
        requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.map(String) : [],
        preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.map(String) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities.map(String) : [],
        minimumExperienceMonths: typeof parsed.minimumExperienceMonths === 'number' ? parsed.minimumExperienceMonths : null,
        educationRequirements: edu as any,
        hardRequirements: hardReqs,
      })
    }

    // 1. DETERMINISTIC ATS READINESS (Used internally for Structure points & coaching)
    const readiness = calculateAtsReadiness(normalizedResume as any)

    let jobMatchResult = undefined
    let coachingResult = undefined
    let aiFailed = false
    let jdExtraction = undefined
    let atsV2Data = undefined

    // 2. ATS V2 INTELLIGENCE PIPELINE (PRIMARY)
    try {
      const v2JdRes = await extractJDIntelligence(jobDescription, companyName, targetRole, userId)
      if (v2JdRes.success && v2JdRes.data) {
        const v2EvalRes = await evaluateResumeEvidence(parsedResumeData, v2JdRes.data, userId)
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
      console.error('[ATS] ATS V2 intelligence pipeline error:', e)
    }

    // 3. TARGETED JOB MATCH (LEGACY V3 ENGINE & COACHING)
    const { systemPrompt: jdSys, userPrompt: jdUser } = buildJDExtractionPrompt(jobDescription, companyName, targetRole)
    const jdValidator = (content: string) => {
      try {
        const repaired = jsonrepair(content)
        const parsed = JSON.parse(repaired)
        normalizeLegacyJd(parsed)
        return { valid: true as const }
      } catch (e: any) {
        return { valid: false as const, reason: e.message }
      }
    }

    const jdAiResult = await callAI(
      { systemPrompt: jdSys, userPrompt: jdUser, maxTokens: 2000, temperature: 0.1, outputFormat: 'json' },
      { feature: 'resume_ats_jd_extract', userId: userId, validator: jdValidator }
    )

    if (jdAiResult.success) {
      try {
        const parsedJd = JSON.parse(jsonrepair(jdAiResult.content))
        jdExtraction = normalizeLegacyJd(parsedJd)

        // DETERMINISTIC Job Match (V3 Engine)
        jobMatchResult = calculateJobMatch(normalizedResume as any, jdExtraction)

        // AI Coaching Feedback
        const { systemPrompt: coachSys, userPrompt: coachUser } = buildAtsCoachingPrompt(
          normalizedResume as any,
          readiness,
          jobMatchResult,
          jdExtraction
        )

        const coachValidator = (content: string) => {
          try {
            const repaired = jsonrepair(content)
            const parsed = JSON.parse(repaired)
            atsCoachingSchema.parse(parsed)
            return { valid: true as const }
          } catch (e: any) {
            return { valid: false as const, reason: e.message }
          }
        }

        const coachAiResult = await callAI(
          { systemPrompt: coachSys, userPrompt: coachUser, maxTokens: 2000, temperature: 0.3, outputFormat: 'json' },
          { feature: 'resume_ats_coaching', userId: userId, validator: coachValidator }
        )

        if (coachAiResult.success) {
          const parsedCoach = JSON.parse(jsonrepair(coachAiResult.content))
          coachingResult = atsCoachingSchema.parse(parsedCoach)
        }
      } catch (e) {
        console.error('[ATS] Legacy V3 parsing or validation error:', e)
      }
    }

    if (!atsV2Data && !jobMatchResult && !coachingResult) {
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
