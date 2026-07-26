import type { ParsedResume } from '@/types/resume'
import type { StructuredJD } from '../../lib/schema/resume/ats-v2'

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

EVALUATION RULES:
1. Grounding & Anti-Hallucination: Use exactText snippets from the resume. Do NOT fabricate or alter quote text.
2. Semantic Matching:
   - Accept legitimate category matching (e.g. "Integrated Stripe, OpenWeather, GitHub APIs" supports "REST APIs" or "API Integration").
   - DO NOT substitute distinct specific technologies! (e.g. Vue is NOT React; Vercel is NOT AWS; Docker is NOT Kubernetes; Power BI is NOT Tableau; MySQL is NOT PostgreSQL).
3. Evidence Strength & Types:
   - Evidence Types: learning, listed_skill, coursework, certification, education, project, professional_experience, achievement, leadership.
   - If a skill is ONLY listed in the Skills list with no project or work experience bullet, set evidenceType to "listed_skill" and evidenceStrength to "moderate" or "weak".
   - Requirement Satisfaction: none, insufficient, partial, substantial, complete.
   - Evidence Strength: none, weak, moderate, strong, exceptional.
4. Quantified Impact:
   - If exactText contains a quantified metric (e.g., "30% reduction", "85,000+ records", "2x faster"), populate quantifiedImpact with that exact metric phrase. Otherwise set quantifiedImpact to null.`

  const userPrompt = `CANDIDATE RESUME DATA:
${JSON.stringify(resume, null, 2)}

STRUCTURED JOB DESCRIPTION REQUIREMENTS:
${JSON.stringify(structuredJd, null, 2)}

Evaluate each requirement and return a JSON object with an "evaluations" array.`

  return { systemPrompt, userPrompt }
}
