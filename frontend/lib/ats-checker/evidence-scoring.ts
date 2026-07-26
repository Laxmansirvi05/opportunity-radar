import type {
  ImportanceLevel,
  RequirementEvaluation,
  JDRequirement,
} from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import type { RequirementScore } from '@/features/resume-toolkit/lib/schema/resume/ats-check'

export const IMPORTANCE_WEIGHTS: Record<ImportanceLevel, number> = {
  critical: 4.0,
  high: 3.0,
  medium: 2.0,
  low: 1.0,
}

export const SATISFACTION_FACTORS: Record<string, number> = {
  none: 0.0,
  insufficient: 0.2,
  partial: 0.5,
  substantial: 0.8,
  complete: 1.0,
}

export const STRENGTH_FACTORS: Record<string, number> = {
  none: 0.0,
  weak: 0.25,
  moderate: 0.5,
  strong: 0.75,
  exceptional: 1.0,
}

export const TYPE_BONUSES: Record<string, number> = {
  professional_experience: 0.12,
  achievement: 0.12,
  project: 0.08,
  certification: 0.08,
  education: 0.06,
  leadership: 0.06,
  listed_skill: 0.03,
  coursework: 0.02,
  learning: 0.0,
}

export function scoreRequirement(
  req: JDRequirement,
  evaluation?: RequirementEvaluation
): RequirementScore {
  const importance = req.importance || 'medium'
  const weight = IMPORTANCE_WEIGHTS[importance] || 2.0

  if (!evaluation) {
    return {
      requirementId: req.id,
      requirementName: req.name,
      category: req.category,
      importance,
      weight,
      satisfactionFactor: 0,
      evidenceStrengthFactor: 0,
      evidenceTypeBonus: 0,
      quantifiedImpactBonus: 0,
      rawScore: 0,
      cappedScore: 0,
      weightedScore: 0,
      maxWeightedScore: weight * 100,
      satisfaction: 'none',
      evidenceStrength: 'none',
      bestEvidenceType: null,
      hasQuantifiedImpact: false,
      gapReason: 'No evaluation provided for this requirement.',
      semanticReasoning: 'Unevaluated requirement defaulted to 0 score.',
    }
  }

  const satFactor = SATISFACTION_FACTORS[evaluation.satisfaction] ?? 0
  const strFactor = STRENGTH_FACTORS[evaluation.evidenceStrength] ?? 0

  let bestTypeBonus = 0
  let bestType: string | null = null
  let hasImpact = false

  if (evaluation.evidenceReferences && evaluation.evidenceReferences.length > 0) {
    for (const ref of evaluation.evidenceReferences) {
      const bonus = TYPE_BONUSES[ref.evidenceType] ?? 0
      if (bonus > bestTypeBonus) {
        bestTypeBonus = bonus
        bestType = ref.evidenceType
      }
      if (ref.quantifiedImpact && ref.quantifiedImpact.trim()) {
        hasImpact = true
      }
    }
  }

  const impactBonus = hasImpact ? 0.1 : 0

  // Base score combines satisfaction and evidence strength
  const baseFactor = satFactor * 0.6 + strFactor * 0.4
  const rawScore = (baseFactor + bestTypeBonus + impactBonus) * 100
  const maxScoreCap = hasImpact ? 100 : 90
  const cappedScore = Math.min(maxScoreCap, Math.max(0, Math.round(rawScore)))
  const weightedScore = (cappedScore / 100) * (weight * 100)
  const maxWeightedScore = weight * 100

  return {
    requirementId: req.id,
    requirementName: req.name,
    category: req.category,
    importance,
    weight,
    satisfactionFactor: satFactor,
    evidenceStrengthFactor: strFactor,
    evidenceTypeBonus: bestTypeBonus,
    quantifiedImpactBonus: impactBonus,
    rawScore: Math.round(rawScore * 100) / 100,
    cappedScore,
    weightedScore: Math.round(weightedScore * 100) / 100,
    maxWeightedScore,
    satisfaction: evaluation.satisfaction,
    evidenceStrength: evaluation.evidenceStrength,
    bestEvidenceType: bestType,
    hasQuantifiedImpact: hasImpact,
    gapReason: evaluation.gapReason || null,
    semanticReasoning: evaluation.semanticReasoning || '',
  }
}
