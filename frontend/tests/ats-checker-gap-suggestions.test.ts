import { describe, it, expect } from 'vitest'
import { deriveSuggestions, suggestionCountForScore } from '@/lib/ats-checker/gap-suggestions'
import type { StructuredJD, EvidenceMatrix } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'

describe('suggestionCountForScore', () => {
  it('shrinks the suggestion budget as score rises, per the score-band guidance', () => {
    expect(suggestionCountForScore(95)).toBeLessThanOrEqual(suggestionCountForScore(85))
    expect(suggestionCountForScore(85)).toBeLessThanOrEqual(suggestionCountForScore(75))
    expect(suggestionCountForScore(75)).toBeLessThanOrEqual(suggestionCountForScore(55))
    expect(suggestionCountForScore(55)).toBeLessThanOrEqual(suggestionCountForScore(20))
  })

  it('keeps every band within a small, non-overwhelming range', () => {
    for (const score of [95, 85, 75, 55, 20]) {
      const n = suggestionCountForScore(score)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(9)
    }
  })
})

describe('deriveSuggestions max option', () => {
  // 12 distinct unmet requirements — enough to exceed every score band's cap.
  const requirements: StructuredJD['requirements'] = Array.from({ length: 12 }, (_, i) => ({
    id: `req_${i}`,
    name: `Skill ${i}`,
    category: 'technical_capability',
    importance: i < 3 ? 'critical' : 'medium',
    provenance: { exactQuote: `Skill ${i}`, context: null },
  })) as StructuredJD['requirements']

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

  const jd: StructuredJD = { requirements } as StructuredJD

  it('caps the returned list at the requested max, prioritising critical items', () => {
    const result = deriveSuggestions(jd, matrix, { max: suggestionCountForScore(85) })
    expect(result.length).toBe(suggestionCountForScore(85))
    expect(result.slice(0, 3).every((s) => s.importance === 'critical')).toBe(true)
  })

  it('a low-scoring resume gets a larger, but still bounded, list than a near-ready one', () => {
    const highScoreList = deriveSuggestions(jd, matrix, { max: suggestionCountForScore(85) })
    const lowScoreList = deriveSuggestions(jd, matrix, { max: suggestionCountForScore(35) })
    expect(lowScoreList.length).toBeGreaterThan(highScoreList.length)
    expect(lowScoreList.length).toBeLessThanOrEqual(12)
  })
})
