import type { ParsedResume } from '@/types/resume'
import type { StructuredJD } from '../lib/schema/resume/ats-v2'

export function buildJDExtractionPrompt(
  jobDescription: string,
  companyName?: string,
  targetRole?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert ATS Job Description Analyzer.
Your task is to parse raw job descriptions into structured requirements adhering strictly to JSON output format.
Category types: hard_requirement, technical_capability, responsibility, experience_level, education, certification, domain_knowledge, tooling_environment, soft_skill, location_auth, preferred_qualification, other.
Importance levels: critical, high, medium, low.
Provide a unique slug id for each requirement (e.g. req_react, req_exp_3_years).
Provide exactQuote from the JD for provenance.`

  const userPrompt = `Job Description:
${jobDescription}

Target Role: ${targetRole || 'Not specified'}
Company: ${companyName || 'Not specified'}

Extract structured requirements as a JSON object with a "requirements" array.`

  return { systemPrompt, userPrompt }
}

export function buildATSv2EvidenceMatrixPrompt(
  resume: ParsedResume,
  structuredJd: StructuredJD
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an evidence-based ATS Evaluation Engine.
Your task is to evaluate the candidate's resume evidence against each requirement in the structured Job Description.
For each requirement, find exact quote evidenceReferences from the resume.
Evidence Types: learning, listed_skill, coursework, certification, education, project, professional_experience, achievement, leadership.
Requirement Satisfaction: none, insufficient, partial, substantial, complete.
Evidence Strength: none, weak, moderate, strong, exceptional.
Do NOT fabricate evidence text. Use exactText snippets from the resume.`

  const userPrompt = `CANDIDATE RESUME DATA:
${JSON.stringify(resume, null, 2)}

STRUCTURED JOB DESCRIPTION REQUIREMENTS:
${JSON.stringify(structuredJd, null, 2)}

Evaluate each requirement and return a JSON object with an "evaluations" array.`

  return { systemPrompt, userPrompt }
}
