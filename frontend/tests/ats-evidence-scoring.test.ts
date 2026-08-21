import { describe, it, expect } from 'vitest'
import { scoreRequirement, TYPE_BONUSES } from '@/lib/ats-checker/evidence-scoring'
import type { JDRequirement, RequirementEvaluation } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

type EvidenceType =
  | 'learning' | 'listed_skill' | 'coursework' | 'certification' | 'education'
  | 'project' | 'professional_experience' | 'achievement' | 'leadership'

const req = (overrides: Partial<JDRequirement> = {}): JDRequirement => ({
  id: 'req_react',
  name: 'React',
  category: 'technical_capability',
  importance: 'high',
  description: null,
  provenance: { exactQuote: 'React', context: null },
  ...overrides,
} as JDRequirement)

const evaluation = (overrides: Partial<RequirementEvaluation> = {}): RequirementEvaluation => ({
  capabilityId: 'req_react',
  satisfaction: 'complete',
  evidenceStrength: 'strong',
  evidenceReferences: [],
  confidence: 0.9,
  semanticReasoning: 'test',
  gapReason: null,
  ...overrides,
} as unknown as RequirementEvaluation)

const evidenceRef = (evidenceType: EvidenceType, quantifiedImpact: string | null = null) => ({
  evidenceId: 'ref_1',
  sourceSection: 'projects',
  exactText: 'React',
  evidenceType,
  quantifiedImpact,
  confidence: 0.9,
})

describe('scoreRequirement — no evaluation', () => {
  it('scores an unevaluated requirement as zero with an explanatory gapReason, not silently dropped', () => {
    const result = scoreRequirement(req(), undefined)
    expect(result.rawScore).toBe(0)
    expect(result.weightedScore).toBe(0)
    expect(result.satisfaction).toBe('none')
    // gapReason is now null: a gap reason describes why the resume fell
    // short, and nothing here fell short — it was never looked at. The
    // distinction is carried by `evaluated`, which keeps these out of the
    // Critical Gaps list and out of the score's denominator.
    expect(result.gapReason).toBeNull()
    expect(result.evaluated).toBe(false)
    expect(result.semanticReasoning).toMatch(/not assessed/i)
  })
})

describe('scoreRequirement — a certification never outscores a project on the same skill', () => {
  it('with satisfaction/strength held equal, project evidence scores higher than certification evidence', () => {
    const certResult = scoreRequirement(
      req(),
      evaluation({ satisfaction: 'complete', evidenceStrength: 'moderate', evidenceReferences: [evidenceRef('certification')] })
    )
    const projectResult = scoreRequirement(
      req(),
      evaluation({ satisfaction: 'complete', evidenceStrength: 'moderate', evidenceReferences: [evidenceRef('project')] })
    )

    expect(projectResult.rawScore).toBeGreaterThan(certResult.rawScore)
    expect(TYPE_BONUSES.project).toBeGreaterThan(TYPE_BONUSES.certification)
  })

  it('professional experience and achievement are the strongest evidence types', () => {
    expect(TYPE_BONUSES.professional_experience).toBeGreaterThan(TYPE_BONUSES.project)
    expect(TYPE_BONUSES.achievement).toBeGreaterThan(TYPE_BONUSES.certification)
  })

  it('a bare skill listing is weaker evidence than either a certification or a project', () => {
    expect(TYPE_BONUSES.listed_skill).toBeLessThan(TYPE_BONUSES.certification)
    expect(TYPE_BONUSES.listed_skill).toBeLessThan(TYPE_BONUSES.project)
  })
})

describe('scoreRequirement — quantified impact', () => {
  it('rewards a quantified outcome over an unquantified one, all else equal', () => {
    const withImpact = scoreRequirement(
      req(),
      evaluation({ evidenceReferences: [evidenceRef('project', 'reduced load time by 40%')] })
    )
    const withoutImpact = scoreRequirement(
      req(),
      evaluation({ evidenceReferences: [evidenceRef('project', null)] })
    )
    expect(withImpact.rawScore).toBeGreaterThan(withoutImpact.rawScore)
    expect(withImpact.hasQuantifiedImpact).toBe(true)
    expect(withoutImpact.hasQuantifiedImpact).toBe(false)
  })

  it('only a quantified match can reach the full 100 cap; an unquantified one caps at 90', () => {
    const maxed = scoreRequirement(
      req(),
      evaluation({
        satisfaction: 'complete',
        evidenceStrength: 'exceptional',
        evidenceReferences: [evidenceRef('professional_experience', 'led a team of 6')],
      })
    )
    const unquantifiedMaxed = scoreRequirement(
      req(),
      evaluation({
        satisfaction: 'complete',
        evidenceStrength: 'exceptional',
        evidenceReferences: [evidenceRef('professional_experience', null)],
      })
    )
    expect(maxed.cappedScore).toBeLessThanOrEqual(100)
    expect(unquantifiedMaxed.cappedScore).toBeLessThanOrEqual(90)
  })
})

describe('scoreRequirement — importance weighting', () => {
  it('a critical requirement carries more weight toward the total than a low-importance one', () => {
    const critical = scoreRequirement(req({ importance: 'critical' }), evaluation())
    const low = scoreRequirement(req({ importance: 'low' }), evaluation())
    expect(critical.weight).toBeGreaterThan(low.weight)
    expect(critical.maxWeightedScore).toBeGreaterThan(low.maxWeightedScore)
  })
})

describe('scoreRequirement — satisfaction levels move the score monotonically', () => {
  it('none < insufficient < partial < substantial < complete, holding everything else equal', () => {
    const levels = ['none', 'insufficient', 'partial', 'substantial', 'complete'] as const
    const scores = levels.map(
      (satisfaction) => scoreRequirement(req(), evaluation({ satisfaction, evidenceReferences: [] })).rawScore
    )
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
  })
})
