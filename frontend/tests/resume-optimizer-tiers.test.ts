import { describe, it, expect } from 'vitest'
import {
  decideTier,
  tierPlan,
  deriveSuggestions,
  targetResumeUnlocked,
  completionProgress,
  POLISH_ONLY_THRESHOLD,
  ALREADY_STRONG_THRESHOLD,
  type Suggestion,
} from '@/lib/resume-optimizer/tiers'
import type { EvidenceMatrix, StructuredJD } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

const req = (id: string, name: string, category: string, importance = 'high') => ({
  id, name, category, importance, description: null,
  provenance: { exactQuote: null, context: null },
}) as unknown as StructuredJD['requirements'][number]

const evaluation = (capabilityId: string, satisfaction: string, gapReason?: string) => ({
  capabilityId,
  satisfaction,
  evidenceStrength: 'weak',
  evidenceReferences: [],
  confidence: 0.9,
  semanticReasoning: 'test',
  gapReason: gapReason ?? null,
}) as unknown as EvidenceMatrix['evaluations'][number]

describe('tier decision', () => {
  it('leaves a strong resume alone rather than rewriting it', () => {
    expect(decideTier(95)).toBe('already_strong')
    expect(decideTier(ALREADY_STRONG_THRESHOLD)).toBe('already_strong')

    const plan = tierPlan('already_strong')
    expect(plan.generatesPolished).toBe(false)
    expect(plan.generatesTarget).toBe(false)
  })

  it('polishes but does not generate a target resume in the 80s', () => {
    expect(decideTier(POLISH_ONLY_THRESHOLD)).toBe('polish_only')
    expect(decideTier(89)).toBe('polish_only')

    const plan = tierPlan('polish_only')
    expect(plan.generatesPolished).toBe(true)
    expect(plan.generatesTarget).toBe(false)
  })

  it('runs the full flow below 80', () => {
    expect(decideTier(79)).toBe('full')
    expect(decideTier(0)).toBe('full')

    const plan = tierPlan('full')
    expect(plan.generatesPolished).toBe(true)
    expect(plan.generatesTarget).toBe(true)
  })

  it('never tells a strong candidate their resume is weak', () => {
    const { headline, explanation } = tierPlan('already_strong')
    expect(`${headline} ${explanation}`.toLowerCase()).not.toMatch(/weak|poor|bad|problem/)
  })
})

describe('deriving suggestions from measured gaps', () => {
  const jd = {
    requirements: [
      req('r_react', 'React', 'technical_capability', 'critical'),
      req('r_docker', 'Docker', 'tooling_environment', 'medium'),
      req('r_aws', 'AWS Certification', 'certification', 'high'),
      req('r_exp', '5 years experience', 'experience_level', 'critical'),
    ],
  } as unknown as StructuredJD

  it('suggests nothing when every requirement is already evidenced', () => {
    const matrix = {
      evaluations: [
        evaluation('r_react', 'complete'),
        evaluation('r_docker', 'complete'),
        evaluation('r_aws', 'substantial'),
        evaluation('r_exp', 'complete'),
      ],
    } as unknown as EvidenceMatrix

    expect(deriveSuggestions(jd, matrix)).toHaveLength(0)
  })

  it('produces one item when only one requirement is missing', () => {
    // This is the adaptive behaviour: a strong resume gets a short list, not a
    // fixed quota of busywork.
    const matrix = {
      evaluations: [
        evaluation('r_react', 'complete'),
        evaluation('r_docker', 'none'),
        evaluation('r_aws', 'complete'),
        evaluation('r_exp', 'complete'),
      ],
    } as unknown as EvidenceMatrix

    const s = deriveSuggestions(jd, matrix)
    expect(s).toHaveLength(1)
    expect(s[0].requirement).toBe('Docker')
    expect(s[0].type).toBe('project')
  })

  it('never suggests manufacturing professional experience', () => {
    const matrix = {
      evaluations: [
        evaluation('r_react', 'complete'),
        evaluation('r_docker', 'complete'),
        evaluation('r_aws', 'complete'),
        evaluation('r_exp', 'none'),
      ],
    } as unknown as EvidenceMatrix

    // A student cannot honestly acquire five years before applying, and
    // suggesting it invites fabrication.
    expect(deriveSuggestions(jd, matrix)).toHaveLength(0)
  })

  it('treats an unevaluated requirement as unknown, not as a gap', () => {
    const matrix = { evaluations: [] } as unknown as EvidenceMatrix
    expect(deriveSuggestions(jd, matrix)).toHaveLength(0)
  })

  it('orders by importance so the critical gap is first', () => {
    const matrix = {
      evaluations: [
        evaluation('r_react', 'none'),
        evaluation('r_docker', 'none'),
        evaluation('r_aws', 'none'),
      ],
    } as unknown as EvidenceMatrix

    const s = deriveSuggestions(jd, matrix)
    expect(s[0].requirement).toBe('React')
    expect(s.map((x) => x.importance)).toEqual(['critical', 'high', 'medium'])
  })

  it('maps each category to the right kind of work', () => {
    const matrix = {
      evaluations: [
        evaluation('r_react', 'none'),
        evaluation('r_aws', 'none'),
      ],
    } as unknown as EvidenceMatrix

    const byReq = Object.fromEntries(deriveSuggestions(jd, matrix).map((s) => [s.requirement, s.type]))
    expect(byReq['React']).toBe('project')
    expect(byReq['AWS Certification']).toBe('certification')
  })

  it('uses the engine\'s own gap reason when it has one', () => {
    const matrix = {
      evaluations: [evaluation('r_react', 'none', 'No React work appears anywhere in the resume.')],
    } as unknown as EvidenceMatrix

    expect(deriveSuggestions(jd, matrix)[0].detail).toBe('No React work appears anywhere in the resume.')
  })

  it('caps the list so a weak resume is not handed twenty tasks', () => {
    const many = {
      requirements: Array.from({ length: 20 }, (_, i) => req(`r_${i}`, `Skill ${i}`, 'technical_capability')),
    } as unknown as StructuredJD
    const matrix = {
      evaluations: Array.from({ length: 20 }, (_, i) => evaluation(`r_${i}`, 'none')),
    } as unknown as EvidenceMatrix

    expect(deriveSuggestions(many, matrix).length).toBeLessThanOrEqual(6)
  })
})

describe('the download gate', () => {
  const make = (completed: boolean[]): Suggestion[] =>
    completed.map((c, i) => ({
      id: `s${i}`, type: 'project', title: 't', detail: 'd',
      requirement: 'r', importance: 'high', completed: c,
    }))

  it('stays locked while any item is outstanding', () => {
    expect(targetResumeUnlocked(make([true, true, false]))).toBe(false)
    expect(targetResumeUnlocked(make([false]))).toBe(false)
  })

  it('unlocks only when every item is confirmed', () => {
    expect(targetResumeUnlocked(make([true, true, true]))).toBe(true)
  })

  it('is unlocked when there was nothing to do', () => {
    expect(targetResumeUnlocked([])).toBe(true)
  })

  it('reports progress for the checklist UI', () => {
    expect(completionProgress(make([true, false, true]))).toEqual({ done: 2, total: 3 })
  })
})
