import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { callAI } from '@/lib/ai-gateway'
import { buildAtsCheckPrompt } from '@/features/resume-toolkit/services/ai/prompts'
import { atsCheckResultSchema } from '@reactive-resume/schema/resume/ats-check'
import { jsonrepair } from 'jsonrepair'

// ---------------------------------------------------------------------------
// POST /api/resume/ats-check
// Accepts { resumeId, jobDescription, companyName? }
// Returns structured ATS analysis (score, keywords, sections, suggestions…)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
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

    // Parse body
    const body = await req.json().catch(() => null)
    if (!body || !body.resumeId || !body.jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: resumeId, jobDescription' },
        { status: 400 }
      )
    }

    const { resumeId, jobDescription, companyName } = body as {
      resumeId: string
      jobDescription: string
      companyName?: string
    }

    if (jobDescription.trim().length < 10) {
      return NextResponse.json(
        { error: 'Job description is too short. Please paste the full posting.' },
        { status: 422 }
      )
    }

    // Fetch resume from DB
    const { data: resume, error: dbError } = await supabase
      .from('resumes')
      .select('id, parsed_data')
      .eq('id', resumeId)
      .single()

    if (dbError || !resume) {
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    // Build ATS prompt
    const { systemPrompt, userPrompt } = buildAtsCheckPrompt(
      resume.parsed_data,
      jobDescription,
      companyName,
    )

    // Call AI
    const aiResult = await callAI(
      {
        systemPrompt,
        userPrompt,
        maxTokens: 4000,
        temperature: 0.2,
        outputFormat: 'json',
      },
      { feature: 'resume_ats', userId: user.id }
    )

    if (!aiResult.success) {
      let friendlyError = 'The AI was unable to analyze this resume.'
      if (aiResult.reason === 'rate_limit') friendlyError = 'AI generation rate limit exceeded. Please wait and try again.'
      else if (aiResult.reason === 'all_failed') friendlyError = 'All AI providers are currently unavailable. Please try again later.'
      else if (aiResult.reason === 'invalid_response') friendlyError = 'The AI returned an empty or invalid response.'
      else friendlyError = `AI analysis failed (${aiResult.reason}). Please try again.`

      return NextResponse.json(
        { error: friendlyError },
        { status: 502 }
      )
    }

    // Parse and validate
    try {
      // Extract JSON from response (strip markdown fences if present)
      let jsonStr = aiResult.content
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
      }

      const repaired = jsonrepair(jsonStr)
      const parsed = JSON.parse(repaired)

      // Normalize AI output variations before validation
      if (parsed) {
        if (typeof parsed.score !== 'number') parsed.score = parseInt(String(parsed.score)) || 50;

        parsed.recommendation = String(parsed.recommendation).toLowerCase().replace(/\s+/g, '_');
        if (!['high_chance', 'medium_chance', 'needs_improvement'].includes(parsed.recommendation)) {
          parsed.recommendation = parsed.score >= 75 ? 'high_chance' : (parsed.score >= 40 ? 'medium_chance' : 'needs_improvement');
        }

        if (!parsed.keywordAnalysis) parsed.keywordAnalysis = {};
        if (!Array.isArray(parsed.keywordAnalysis.matched)) parsed.keywordAnalysis.matched = [];
        if (!Array.isArray(parsed.keywordAnalysis.missing)) parsed.keywordAnalysis.missing = [];

        if (!Array.isArray(parsed.sectionAnalysis)) parsed.sectionAnalysis = [];
        parsed.sectionAnalysis = parsed.sectionAnalysis.map((s: any) => ({
          section: s.section || 'General',
          score: typeof s.score === 'number' ? s.score : (parseInt(String(s.score)) || 50),
          feedback: s.feedback || 'Looks good.',
        }));

        if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
        parsed.suggestions = parsed.suggestions.map((s: any) => ({
          title: s.title || 'Improvement',
          description: s.description || 'Consider optimizing this section.',
          impact: ['high', 'medium', 'low'].includes(String(s.impact).toLowerCase()) ? String(s.impact).toLowerCase() : 'medium'
        })).slice(0, 10);

        if (!Array.isArray(parsed.suggestedProjects)) parsed.suggestedProjects = [];
        parsed.suggestedProjects = parsed.suggestedProjects.map((p: any) => ({
          title: p.title || 'Relevant Project',
          description: p.description || 'Add a project showcasing these skills.'
        })).slice(0, 5);

        if (!Array.isArray(parsed.powerWords)) parsed.powerWords = [];
        parsed.powerWords = parsed.powerWords.map(String).slice(0, 20);
      } else {
        throw new Error('AI returned null or empty object');
      }

      const validated = atsCheckResultSchema.parse(parsed)

      // Persist to resume_ats_reports table
      await supabase.from('resume_ats_reports').insert({
        resume_id: resumeId,
        target_job_description: jobDescription.slice(0, 5000),
        score: validated.score,
        report_data: validated,
      })

      return NextResponse.json(validated)
    } catch (parseError: any) {
      console.error('[ATS] Validation failed:', parseError?.flatten ? parseError.flatten() : parseError)
      return NextResponse.json(
        { error: 'The AI returned an improperly formatted analysis that could not be parsed.' },
        { status: 400 }
      )
    }
  } catch (error: unknown) {
    console.error('[ATS] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
