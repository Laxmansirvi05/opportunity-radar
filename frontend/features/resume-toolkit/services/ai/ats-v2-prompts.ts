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
Provide exactQuote from the JD for provenance.
OUTPUT MUST STRICTLY MATCH THIS SCHEMA:
{
  "requirements": [
    {
      "id": "slug_id",
      "name": "Requirement Name (e.g. React.js)",
      "category": "technical_capability",
      "importance": "high",
      "description": "Brief description",
      "provenance": { "exactQuote": "extracted quote from JD" }
    }
  ]
}`

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
4. Grounding & Anti-Hallucination: You will receive both parsed JSON and RAW RESUME TEXT. 
   RAW RESUME TEXT IS THE SOURCE OF TRUTH.
   If structured resume data omits something that clearly exists in rawResumeText, use the raw text evidence.
   Never mark a requirement missing solely because parsedResume.skills or project.technologies omitted it.
5. Use exactText snippets extracted DIRECTLY from the RAW RESUME TEXT. Do NOT fabricate or alter quote text. Do NOT manufacture missing evidence.
   - Do NOT invent technologies based on related technologies.
   - React present -> React can match.
   - Next.js present -> Next.js can match.
   - Git/GitHub present -> Git/GitHub can match.
   - React present DOES NOT imply Angular.
   - JavaScript present DOES NOT imply TypeScript.
   - API usage DOES NOT automatically imply REST API unless supported.
6. Semantic Matching:
   - Accept legitimate category matching (e.g. "Integrated Stripe, OpenWeather, GitHub APIs" supports "REST APIs" or "API Integration").
   - DO NOT substitute distinct specific technologies! (e.g. Vue is NOT React; Vercel is NOT AWS; Docker is NOT Kubernetes; Power BI is NOT Tableau; MySQL is NOT PostgreSQL).
7. Evidence Strength & Types:
   - Evidence Types: learning, listed_skill, coursework, certification, education, project, professional_experience, achievement, leadership.
   - If a skill is ONLY listed in a generic Skills list with no project or work experience context, set evidenceType to "listed_skill" and evidenceStrength to "weak" (or "moderate" at best). A candidate should not receive a strong skill match merely because a technology name appears once.
   - Differentiate clearly: professional_experience (strongest) vs project (strong) vs listed_skill (weak) vs none.
   - Requirement Satisfaction: none, insufficient, partial, substantial, complete. Use "partial" if they have weak evidence or lack professional application. Use "none" for genuinely missing requirements.
5. Quantified Impact:
   - If exactText contains a quantified metric (e.g., "30% reduction", "85,000+ records", "2x faster"), populate quantifiedImpact with that exact metric phrase. Otherwise set quantifiedImpact to null.`

  const userPrompt = `CANDIDATE RESUME JSON:
${JSON.stringify(resume, null, 2)}

RAW RESUME TEXT (Source of Truth):
${(resume as any).rawText || 'Raw text unavailable.'}

STRUCTURED JOB DESCRIPTION REQUIREMENTS:
${JSON.stringify(structuredJd, null, 2)}

Evaluate each requirement and return a JSON object with an "evaluations" array.
OUTPUT MUST STRICTLY MATCH THIS SCHEMA:
{
  "evaluations": [
    {
      "capabilityId": "slug_id_from_jd",
      "satisfaction": "complete",
      "evidenceStrength": "strong",
      "semanticReasoning": "Found React mentioned in AI Chatbox project.",
      "evidenceReferences": [
        {
          "evidenceId": "ref_1",
          "sourceSection": "projects",
          "exactText": "React, Next.js, Tailwind CSS",
          "evidenceType": "project",
          "quantifiedImpact": null,
          "confidence": 0.9
        }
      ]
    }
  ]
}`

  return { systemPrompt, userPrompt }
}
