import type { ATSAnalysisResult, ATSFallback, ATSResponse } from '@/types/ats'
import type { ParsedResume }   from '@/types/resume'
import type { Opportunity }    from '@/types/opportunity'
import {
  normaliseSkillArray,
  computeSkillScore,
  computeProjectScore,
  computeExperienceScore,
  computeEducationScore,
  computeATSScore,
  computeImprovementScore,
  deriveStudentLevel,
} from './scoring'
import { computeGapAnalysis, generateImprovementSuggestions } from './gap-analysis'

// ---------------------------------------------------------------------------
// ATS Engine Entry Point
// Pure TypeScript — no database calls, no AI. Fully deterministic.
// ---------------------------------------------------------------------------
export function runATSEngine(
  parsedResume: ParsedResume,
  extractedSkills: string[],
  extractedProjectKeywords: string[],
  opportunity: Pick<Opportunity, 'extracted_skills' | 'experience_level' | 'title'>,
  frequencyMap: Map<string, number>  // From skill_frequency_index table
): ATSAnalysisResult {
  // Normalise all arrays (already normalised at save time, but defensive)
  const studentSkills    = normaliseSkillArray(extractedSkills)
  const projectKeywords  = normaliseSkillArray(extractedProjectKeywords)
  const oppSkills        = normaliseSkillArray(opportunity.extracted_skills ?? [])

  // -----------------------------------------------------------------------
  // Component scoring
  // -----------------------------------------------------------------------
  const { score: skillScore, matched: matchedSkills } = computeSkillScore(studentSkills, oppSkills)
  const { score: projectScore, matched: projectMatched } = computeProjectScore(
    projectKeywords, oppSkills, matchedSkills
  )

  // Derive experience level from parsed experience array
  const totalMonths = parsedResume.experience.reduce((acc, exp) => {
    const start = new Date(exp.start_date)
    const end   = exp.end_date ? new Date(exp.end_date) : new Date()
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                   (end.getMonth() - start.getMonth())
    return acc + Math.max(0, months)
  }, 0)

  const studentLevel    = deriveStudentLevel(totalMonths)
  const experienceScore = computeExperienceScore(studentLevel, opportunity.experience_level)

  // Education: use highest degree level from education array
  const degreeRank = { doctorate: 4, masters: 3, bachelors: 2, diploma: 1, other: 0 }
  const highestDegree = parsedResume.education
    .map((e) => e.degree_level)
    .sort((a, b) => degreeRank[b] - degreeRank[a])[0]

  const educationScore = computeEducationScore(highestDegree, null)  // No degree req in MVP

  // -----------------------------------------------------------------------
  // Aggregate score
  // -----------------------------------------------------------------------
  const atsScore = computeATSScore({
    skill_score:      skillScore,
    project_score:    projectScore,
    experience_score: experienceScore,
    education_score:  educationScore,
  })

  const improvementScore = computeImprovementScore({
    project_score:    projectScore,
    experience_score: experienceScore,
    education_score:  educationScore,
  })

  // -----------------------------------------------------------------------
  // Gap analysis
  // -----------------------------------------------------------------------
  const gapAnalysis = computeGapAnalysis(
    studentSkills,
    projectKeywords,
    matchedSkills,
    projectMatched,
    oppSkills,
    opportunity.title,
    frequencyMap
  )

  // Populate experience gap
  if (experienceScore < 1.0) {
    gapAnalysis.experience_gap = {
      required:    opportunity.experience_level ?? 'Unknown',
      student_has: studentLevel,
      gap:         `This role expects ${opportunity.experience_level}; your level is ${studentLevel}.`,
    }
  }

  // -----------------------------------------------------------------------
  // Improvement suggestions
  // -----------------------------------------------------------------------
  const suggestions = generateImprovementSuggestions(
    gapAnalysis.missing_skills,
    gapAnalysis.bonus_skills,
    gapAnalysis.project_gap,
    experienceScore >= 1.0,
    educationScore >= 1.0
  )

  // -----------------------------------------------------------------------
  // Resume freshness (stored, not scored in MVP)
  // -----------------------------------------------------------------------
  const freshness: 'fresh' | 'stale' | 'unknown' = 'fresh'  // Populated by caller from updated_at

  return {
    ats_score: atsScore,
    score_breakdown: {
      skill_score:      skillScore,
      project_score:    projectScore,
      experience_score: experienceScore,
      education_score:  educationScore,
      final_score:      atsScore,
    },
    gap_analysis:            gapAnalysis,
    improvement_score:       improvementScore,
    improvement_suggestions: suggestions,
    resume_freshness:        freshness,
  }
}

// ---------------------------------------------------------------------------
// Fallback result when no verified resume exists
// ---------------------------------------------------------------------------
export function buildATSFallback(): ATSFallback {
  return {
    fallback:   true,
    ats_score:  null,
    message:    'Upload and verify your resume to see your personalised ATS score.',
  }
}
