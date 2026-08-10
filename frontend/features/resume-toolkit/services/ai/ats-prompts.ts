import type { ParsedResume } from '@/types/resume'
import type { AtsV2Score } from '../../lib/schema/resume/ats-check'
import type { StructuredJD, EvidenceMatrix } from '../../lib/schema/resume/ats-v2'

/**
 * Purely qualitative narration on top of the deterministic V2 score — a
 * recruiter's voice, not a second opinion. The score, the matched/missing
 * requirements and the improvement checklist are already final by the time
 * this runs (calculateAtsV2Score + deriveSuggestions); this call is not
 * allowed to recompute or contradict any of it, only to narrate it.
 */
export function buildAtsCoachingPrompt(
  resume: ParsedResume,
  structuredJd: StructuredJD,
  evidenceMatrix: EvidenceMatrix,
  score: AtsV2Score
) {
  const systemPrompt = `You are an expert technical recruiter giving a candidate a short, honest verbal debrief after screening their
resume against a specific role. You are given the FINAL, already-computed evidence evaluation and score — your job is
only to narrate it in plain, human language, not to recompute or second-guess it.

DO NOT recalculate the score, satisfaction levels, or evidence strength — they are final.
DO NOT claim the candidate possesses skills, projects, or certifications not present in the evaluation you were given.
DO NOT restate the checklist of missing requirements — that is shown separately. Your job is the holistic verdict and
some strong action verbs, nothing else.

Output ONLY valid JSON matching the schema below.

SCHEMA:
{
  "recruiterVerdict": "string (2-4 sentences, first-person recruiter voice, e.g. what stands out, what's a real concern, and the honest bottom line — grounded ONLY in the evidence evaluation you were given, referencing specific things you were told the candidate did or didn't demonstrate)",
  "powerWords": ["string", "string"]
}

Rules:
- powerWords: 8-20 strong action verbs the candidate could use to sharpen their own bullet points; not required to relate to specific gaps, just generally strong resume verbs (e.g. "Engineered", "Reduced", "Shipped").
- The recruiterVerdict must read like a person who actually reviewed this resume wrote it, not a template — reference the specific band/score context you were given (e.g. "This scores in the moderate range mainly because...").`

  const userContext = {
    overallScore: score.overallScore,
    band: score.band,
    capabilityScore: score.capabilityScore,
    qualityScore: score.qualityScore,
    roleTitle: structuredJd.roleTitle,
    companyName: structuredJd.companyName,
    requirementEvaluations: score.requirements.map((r) => {
      const ev = evidenceMatrix.evaluations.find((e) => e.capabilityId === r.requirementId)
      return {
        requirement: r.requirementName,
        importance: r.importance,
        satisfaction: r.satisfaction,
        evidenceStrength: r.evidenceStrength,
        reasoning: r.semanticReasoning,
        citedEvidence: ev?.evidenceReferences.slice(0, 2).map((e) => e.exactText) ?? [],
      }
    }),
    hardRequirements: score.hardRequirements,
    resumeSummary: resume.summary,
  }

  return { systemPrompt, userPrompt: JSON.stringify(userContext, null, 2) }
}
