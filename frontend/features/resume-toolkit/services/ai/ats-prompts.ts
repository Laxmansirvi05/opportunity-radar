import type { ParsedResume } from '@/types/resume'
import type { JDExtraction, AtsReadinessResult, JobMatchResult } from '../../lib/schema/resume/ats-check'

export function buildJDExtractionPrompt(jobDescription: string, companyContext?: string, targetRoleContext?: string) {
  const systemPrompt = `You are an expert Job Description analyzer.
Extract strict structured requirements from the provided job description and contextual information.
Do NOT invent requirements. Do NOT evaluate any resume.
Output ONLY valid JSON matching the schema below.

SCHEMA:
{
  "targetRole": "string",
  "company": "string or null",
  "roleFamily": "string (e.g. Frontend, Backend, Data Science, Design, Sales, etc.)",
  "requiredSkills": ["string"],
  "preferredSkills": ["string"],
  "keywords": ["string"],
  "responsibilities": ["string"],
  "minimumExperienceMonths": number | null,
  "educationRequirements": "doctorate" | "masters" | "bachelors" | "diploma" | "other" | "none",
  "hardRequirements": [
    {
      "rule": "string",
      "type": "Required" | "Eligibility"
    }
  ]
}

Rules:
- Job Description is the primary source of truth.
- Target Role may help disambiguate the JD, but Company Name is context only. Never invent requirements because of the company name.
- For minimumExperienceMonths, convert years to months (e.g. 2 years = 24). If not specified, return null.
- "Nice to have", "preferred", "bonus" -> preferredSkills, NOT requiredSkills. Keep required and preferred skills separate.
- Extract distinct technical skills, tools, and methodologies. Do not guess.
- Extract softer skills or industry terms into keywords.
- Do NOT extract benefits, EEO text, company marketing, salary, or generic HR language as keywords.
- hardRequirements: Capture explicit disqualifying rules (e.g., 'Must be graduating in 2027', 'Needs clearance', 'Work authorization required').
- educationRequirements must exactly match one of the enum values.`

  const userPrompt = `Target Role Context: ${targetRoleContext || 'None'}
Company Context: ${companyContext || 'None'}

JOB DESCRIPTION:
${jobDescription}`

  return { systemPrompt, userPrompt }
}

export function buildAtsCoachingPrompt(
  resume: ParsedResume,
  readiness: AtsReadinessResult,
  jobMatch?: JobMatchResult,
  jd?: JDExtraction
) {
  const systemPrompt = `You are an expert career coach helping a candidate improve their resume for a SPECIFIC role.
You are provided with:
1. The student's structured resume.
2. The Targeted ATS Match Score and deductions.
3. The extracted Job Requirements.

Your task is to provide QUALITATIVE COACHING based on the facts provided.
DO NOT recalculate the score. The score is already final.
DO NOT claim the candidate possesses skills, projects, or certifications they do not have.
Clearly distinguish between FACTS (what is in their resume) and RECOMMENDATIONS (what they should add).

Output ONLY valid JSON matching the schema below.

SCHEMA:
{
  "suggestions": [
    {
      "title": "string",
      "description": "string (MUST be actionable and labeled as a recommendation)",
      "impact": "high" | "medium" | "low"
    }
  ],
  "suggestedProjects": [
    {
      "title": "string",
      "description": "string (Brief description of a project to fill skill gaps)"
    }
  ],
  "powerWords": ["string", "string"],
  "missingKeywordExplanations": [
    {
      "keyword": "string",
      "reason": "string (Why this missing keyword matters for the role)"
    }
  ]
}

Rules:
- Max 10 suggestions, max 5 projects, max 20 power words.
- Base your coaching on the "Deductions" and "Missing Skills" provided in the input context.
- Focus heavily on bridging the missing required skills and hard requirements.`

  const userContext = {
    resume,
    readinessDeductions: readiness.categories,
    jobMatchDeductions: jobMatch?.categories,
    missingRequiredSkills: jobMatch?.missingRequiredSkills,
    missingPreferredSkills: jobMatch?.missingPreferredSkills,
    hardRequirementsStatus: jobMatch?.hardRequirements,
    jobRequirements: jd
  }

  return { systemPrompt, userPrompt: JSON.stringify(userContext, null, 2) }
}
