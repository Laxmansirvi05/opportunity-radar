import { describe, it, expect } from 'vitest'
import { deriveSuggestions, suggestionCountForScore } from '@/lib/ats-checker/gap-suggestions'
import type { StructuredJD, EvidenceMatrix } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

describe('suggestionCountForScore', () => {
  it('shrinks the per-category suggestion budget as score rises, per the score-band guidance', () => {
    expect(suggestionCountForScore(95)).toBeLessThanOrEqual(suggestionCountForScore(85))
    expect(suggestionCountForScore(85)).toBeLessThanOrEqual(suggestionCountForScore(70))
    expect(suggestionCountForScore(70)).toBeLessThanOrEqual(suggestionCountForScore(55))
    expect(suggestionCountForScore(55)).toBeLessThanOrEqual(suggestionCountForScore(20))
  })

  it('keeps every band within a small, non-overwhelming range', () => {
    for (const score of [95, 85, 70, 55, 20]) {
      const n = suggestionCountForScore(score)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(5)
    }
  })
})

describe('deriveSuggestions per-category caps', () => {
  // A mix of categories: technical_capability -> 'project' type (per
  // typeForCategory), certification -> 'certification' type. Both are
  // unmet, so both groups have plenty of candidates to cap independently.
  const projectRequirements: StructuredJD['requirements'] = Array.from({ length: 8 }, (_, i) => ({
    id: `req_tech_${i}`,
    name: `Tech ${i}`,
    category: 'technical_capability',
    importance: i < 2 ? 'critical' : 'medium',
    provenance: { exactQuote: `Tech ${i}`, context: null },
  })) as StructuredJD['requirements']

  const certRequirements: StructuredJD['requirements'] = Array.from({ length: 8 }, (_, i) => ({
    id: `req_cert_${i}`,
    name: `Cert ${i}`,
    category: 'certification',
    importance: i < 2 ? 'critical' : 'medium',
    provenance: { exactQuote: `Cert ${i}`, context: null },
  })) as StructuredJD['requirements']

  const requirements = [...projectRequirements, ...certRequirements]
  const jd: StructuredJD = { requirements } as StructuredJD

  const matrix: EvidenceMatrix = {
    evaluations: requirements.map((r) => ({
      capabilityId: r.id,
      satisfaction: 'none',
      evidenceStrength: 'weak',
      evidenceReferences: [],
      confidence: 0.9,
      semanticReasoning: 'test',
      gapReason: 'No evidence found',
    })),
  } as unknown as EvidenceMatrix

  it('caps projects and non-projects independently, prioritising critical items within each group', () => {
    const result = deriveSuggestions(jd, matrix, { maxProjects: 2, maxOther: 3 })

    const projects = result.filter((s) => s.type === 'project')
    const other = result.filter((s) => s.type !== 'project')

    expect(projects.length).toBe(2)
    expect(other.length).toBe(3)
    // Both fixtures have exactly 2 critical items — the caps here (2 and 3)
    // guarantee every critical item is included, with the cap only reaching
    // into 'medium' once there's room left over.
    expect(projects.every((s) => s.importance === 'critical')).toBe(true)
    expect(other.filter((s) => s.importance === 'critical').length).toBe(2)
  })

  it('a project-heavy gap set does not crowd out non-project suggestions', () => {
    // Before the per-category split, a single combined cap could fill
    // entirely with 'project' type (the most common mapping for technical
    // gaps) and never surface a single certification/course suggestion.
    const result = deriveSuggestions(jd, matrix, { maxProjects: 4, maxOther: 4 })
    expect(result.some((s) => s.type === 'project')).toBe(true)
    expect(result.some((s) => s.type !== 'project')).toBe(true)
  })

  it('a low-scoring resume gets a larger, but still bounded, list in each category than a near-ready one', () => {
    const highBudget = suggestionCountForScore(85)
    const lowBudget = suggestionCountForScore(35)

    const highScoreList = deriveSuggestions(jd, matrix, { maxProjects: highBudget, maxOther: highBudget })
    const lowScoreList = deriveSuggestions(jd, matrix, { maxProjects: lowBudget, maxOther: lowBudget })

    expect(lowScoreList.length).toBeGreaterThan(highScoreList.length)
    expect(lowScoreList.length).toBeLessThanOrEqual(requirements.length)
  })

  it('defaults to 4 per category when no options are given', () => {
    const result = deriveSuggestions(jd, matrix)
    expect(result.filter((s) => s.type === 'project').length).toBe(4)
    expect(result.filter((s) => s.type !== 'project').length).toBe(4)
  })
})
