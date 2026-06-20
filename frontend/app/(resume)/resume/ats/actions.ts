'use server'

import { createClient } from '@/lib/supabase/server'
import { generateText, Output } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { atsCheckOutputSchema, atsCheckResultSchema } from '@reactive-resume/schema/resume/ats-check'
// I'll inline the ATS check system prompt or load it if available
// For simplicity, I will inline a simplified version or load it from the filesystem
import fs from 'fs'
import path from 'path'
import type { ResumeData } from '@reactive-resume/schema/resume/data'

export async function runAtsCheckAction(resumeId: string, jobDescription: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Fetch resume
  const { data: resume, error } = await supabase
    .from('resumes')
    .select('data, parsed_data')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (error || !resume) {
    throw new Error('Resume not found')
  }

  // Fallback logic
  let resumeData = resume.data
  if (!resumeData && resume.parsed_data) {
    resumeData = resume.parsed_data
  }

  if (!resumeData) {
    throw new Error('Resume data is empty. Please build your resume first.')
  }

  // Use Gemini 1.5 Flash
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('AI Provider not configured')
  }

  const gemini = createGoogleGenerativeAI({ apiKey })
  const model = gemini('gemini-1.5-flash')

  // Build the system prompt
  // In a real app, we'd read the prompt file. Let's try reading it from the schema directory if it's there
  // Actually, we didn't copy prompts.ts! Let's just inline the ATS prompt to ensure it works
  const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and career coach.

Your task is to evaluate the provided resume data against a specific job description and return a structured ATS compatibility analysis.

## Inputs
1. Resume JSON
2. Job Description

## Strict Output Contract
Return only a raw JSON object matching this exact structure. No markdown fences, no explanation text:
{
  "score": 0-100,
  "keywordAnalysis": {
    "matched": ["keyword1"],
    "missing": ["keyword3"]
  },
  "sectionAnalysis": [
    {
      "section": "string",
      "score": 0-100,
      "feedback": "string"
    }
  ],
  "suggestions": [
    {
      "title": "string",
      "description": "string",
      "impact": "high" | "medium" | "low"
    }
  ],
  "suggestedProjects": [
    {
      "title": "string",
      "description": "string"
    }
  ],
  "powerWords": ["string"],
  "recommendation": "high_chance" | "medium_chance" | "needs_improvement"
}`

  const userMsg = `## Resume JSON
${JSON.stringify(resumeData, null, 2)}

## Job Description
${jobDescription}`

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: atsCheckOutputSchema }),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ]
    })

    if (!result.output) {
      throw new Error('AI returned empty response')
    }

    const validated = atsCheckResultSchema.parse(result.output)
    return validated

  } catch (err) {
    console.error('ATS Check failed:', err)
    throw new Error('Failed to analyze resume against job description.')
  }
}
