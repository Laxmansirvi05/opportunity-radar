import type { StructuredJD, EvidenceMatrix } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import type {
  AtsV2Score,
  RequirementScore,
  ResumeQualityScore,
  HardRequirementResult,
  ScoreConfidence,
} from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import type { ParsedResume } from '@/types/resume'
import { getJdRequirements } from './jd-requirements'
import { stringList } from '@/lib/resume-fields'
import { scoreRequirement } from './evidence-scoring'

export function calculateQualityScore(resume: ParsedResume): ResumeQualityScore {
  const hasSummary = Boolean(resume.summary && resume.summary.trim().length > 10)
  const hasExperience = Boolean(resume.experience && resume.experience.length > 0)
  const hasEducation = Boolean(resume.education && resume.education.length > 0)
  const hasSkills = Boolean(resume.skills && resume.skills.length > 0)
  const hasProjects = Boolean(resume.projects && resume.projects.length > 0)
  const hasContactInfo = Boolean(resume.name && (resume.email || resume.phone))

  let hasQuantifiedBullets = false
  if (resume.experience) {
    for (const exp of resume.experience) {
      // `bullets` is the schema field; `highlights` is the older key that
      // resumes parsed before the rename still carry.
      const bullets = stringList(exp, 'bullets', 'highlights')
      if (Array.isArray(bullets)) {
        for (const h of bullets) {
          if (
            typeof h === 'string' &&
            /(?:\$\d+|\b\d+(?:,\d{3})+|\b\d+(?:\.\d+)?\s*(?:%|\+|k|M|B|x|percent|hrs|hours|users|clients|records|ms|sec|seconds|min|minutes))/i.test(h)
          ) {
            hasQuantifiedBullets = true
            break
          }
        }
      }
      if (hasQuantifiedBullets) break
    }
  }

  let total = 0
  if (hasContactInfo) total += 15
  if (hasExperience) total += 25
  if (hasEducation) total += 15
  if (hasSkills) total += 15
  if (hasProjects) total += 15
  if (hasSummary) total += 5
  if (hasQuantifiedBullets) total += 10

  return {
    total,
    hasSummary,
    hasExperience,
    hasEducation,
    hasSkills,
    hasProjects,
    hasQuantifiedBullets,
    hasContactInfo,
  }
}

export function evaluateHardRequirements(
  structuredJd: StructuredJD,
  resume: ParsedResume
): HardRequirementResult {
  const reqs = getJdRequirements(structuredJd)
  const hardReqs = reqs.filter((r) => r.category === 'hard_requirement')
  if (hardReqs.length === 0) {
    return { passed: true, cap: null, failedRequirements: [] }
  }

  const failed: string[] = []

  for (const req of hardReqs) {
    const text = (req.name + ' ' + (req.description || '')).toLowerCase()

    if (text.includes('graduat') || text.includes('degree') || text.includes('bachelor') || text.includes('b.s.') || text.includes('b.tech')) {
      const eduPresent = resume.education && resume.education.length > 0
      if (!eduPresent) {
        failed.push(req.name)
      }
    }
  }

  if (failed.length > 0) {
    return {
      passed: false,
      cap: 60,
      failedRequirements: failed,
      reason: `Failed hard requirement(s): ${failed.join(', ')}`,
    }
  }

  return { passed: true, cap: null, failedRequirements: [] }
}

export function calculateAtsV2Score(
  structuredJd: StructuredJD,
  evidenceMatrix: EvidenceMatrix,
  resume: ParsedResume
): AtsV2Score {
  const evaluationsMap = new Map(
    (evidenceMatrix.evaluations || []).map((e) => [e.capabilityId, e])
  )

  const reqScores: RequirementScore[] = []
  let totalWeightedScore = 0
  let totalMaxWeight = 0
  let evaluatedCount = 0
  let confidenceSum = 0
  const reqs = getJdRequirements(structuredJd)
  const unevaluated: string[] = []

  for (const req of reqs) {
    const ev = evaluationsMap.get(req.id)
    if (ev) {
      evaluatedCount++
      confidenceSum += ev.confidence ?? 0.8
    } else {
      unevaluated.push(req.id)
    }

    const scored = scoreRequirement(req, ev)
    reqScores.push(scored)

    // Only requirements that were actually assessed move the score. A
    // requirement the evaluator never returned used to land in the
    // denominator at full weight with a zero numerator, so an evaluator that
    // ran out of output tokens read as a resume missing everything it had not
    // reached — the student was marked down for our truncation. It is still
    // listed (as "not assessed") and still lowers the reported coverage.
    if (ev) {
      totalWeightedScore += scored.weightedScore
      totalMaxWeight += scored.maxWeightedScore
    }
  }

  const capabilityScore =
    totalMaxWeight > 0 ? Math.round((totalWeightedScore / totalMaxWeight) * 100) : 0

  const quality = calculateQualityScore(resume)
  const qualityScore = quality.total

  let overallScore = Math.round(capabilityScore * 0.85 + qualityScore * 0.15)

  const hardReqResult = evaluateHardRequirements(structuredJd, resume)
  let scoreCappedReason: string | undefined

  if (!hardReqResult.passed && hardReqResult.cap !== null) {
    if (overallScore > hardReqResult.cap) {
      overallScore = hardReqResult.cap
      scoreCappedReason = hardReqResult.reason
    }
  }

  // Band classification
  let band: AtsV2Score['band'] = 'poor'
  if (overallScore >= 90) band = 'exceptional'
  else if (overallScore >= 78) band = 'strong'
  else if (overallScore >= 65) band = 'moderate'
  else if (overallScore >= 50) band = 'partial'
  else if (overallScore >= 35) band = 'weak'
  else band = 'poor'

  const totalReqs = structuredJd.requirements.length
  const coverage = totalReqs > 0 ? evaluatedCount / totalReqs : 1.0
  const meanAIConf = evaluatedCount > 0 ? confidenceSum / evaluatedCount : 0

  let confLevel: ScoreConfidence['confidenceLevel'] = 'full'
  if (coverage < 0.5 || meanAIConf < 0.4) confLevel = 'low'
  else if (coverage < 0.8 || meanAIConf < 0.6) confLevel = 'moderate'
  else if (coverage < 1.0 || meanAIConf < 0.8) confLevel = 'high'

  const confidence: ScoreConfidence = {
    confidenceLevel: confLevel,
    evaluationCoverage: Math.round(coverage * 100) / 100,
    retrievalDegraded: coverage < 1.0,
    meanAIConfidence: Math.round(meanAIConf * 100) / 100,
    unevaluatedRequirements: unevaluated,
  }

  return {
    overallScore,
    capabilityScore,
    qualityScore,
    band,
    requirements: reqScores,
    quality,
    hardRequirements: hardReqResult,
    confidence,
    scoreCappedReason,
  }
}
