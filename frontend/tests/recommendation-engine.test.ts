import { describe, it, expect } from 'vitest'
import {
  getMatchLabel,
  buildMatchCardSummary,
  buildMatchExplanation,
  sortByMatchScore,
  filterFeedLocally,
} from '@/lib/recommendation-engine/scoring'
import type { RankedOpportunity } from '@/types/opportunity'

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------
function makeOpp(overrides: Partial<RankedOpportunity>): RankedOpportunity {
  return {
    id:                      'opp-1',
    title:                   'Software Engineer',
    company_id:              null,
    category:                'Technology',
    location:                'Remote',
    mode:                    'Remote',
    experience_level:        'Fresher',
    deadline:                null,
    is_paid:                 true,
    apply_url:               'https://example.com',
    posted_at:               '2024-06-01T00:00:00Z',
    status:                  'Published',
    description:             null,
    skills:                  null,
    extracted_skills:        ['python', 'sql', 'pandas'],
    skill_extraction_status: 'processed',
    skill_extraction_version: 'v1',
    last_verified_at:        null,
    recruiter_avatar_url:    null,
    recruiter_name:          null,
    recruiter_role:          null,
    report_count:            0,
    responsibilities:        null,
    submitted_by:            null,
    trust_score:             null,
    source_type:             null,
    created_at:              '2024-06-01T00:00:00Z',
    updated_at:              '2024-06-01T00:00:00Z',
    match_score:             75,
    matched_skills:          ['python', 'sql'],
    missing_skills:          ['pandas'],
    skill_coverage_pct:      66.7,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getMatchLabel
// ---------------------------------------------------------------------------
describe('getMatchLabel', () => {
  it('returns Excellent Match for score >= 80', () => {
    expect(getMatchLabel(80)).toBe('Excellent Match')
    expect(getMatchLabel(100)).toBe('Excellent Match')
  })

  it('returns Good Match for score 60–79', () => {
    expect(getMatchLabel(60)).toBe('Good Match')
    expect(getMatchLabel(79)).toBe('Good Match')
  })

  it('returns Partial Match for score 40–59', () => {
    expect(getMatchLabel(40)).toBe('Partial Match')
    expect(getMatchLabel(59)).toBe('Partial Match')
  })

  it('returns Low Match for score < 40', () => {
    expect(getMatchLabel(39)).toBe('Low Match')
    expect(getMatchLabel(0)).toBe('Low Match')
  })
})

// ---------------------------------------------------------------------------
// buildMatchCardSummary
// ---------------------------------------------------------------------------
describe('buildMatchCardSummary', () => {
  it('builds correct summary from ranked opportunity', () => {
    const opp     = makeOpp({ match_score: 75 })
    const summary = buildMatchCardSummary(opp)

    expect(summary.match_score).toBe(75)
    expect(summary.score_label).toBe('Good Match')
    expect(summary.matched_skills).toEqual(['python', 'sql'])
    expect(summary.missing_count).toBe(1)
    expect(summary.skill_coverage_pct).toBeCloseTo(66.7)
  })

  it('returns Excellent Match for score 85', () => {
    const opp     = makeOpp({ match_score: 85 })
    const summary = buildMatchCardSummary(opp)
    expect(summary.score_label).toBe('Excellent Match')
  })
})

// ---------------------------------------------------------------------------
// buildMatchExplanation
// ---------------------------------------------------------------------------
describe('buildMatchExplanation', () => {
  it('returns explanation with correct matched/missing skills', () => {
    const opp         = makeOpp({ match_score: 75 })
    const explanation = buildMatchExplanation(opp)

    expect(explanation.matched_skills).toEqual(['python', 'sql'])
    expect(explanation.missing_skills).toEqual(['pandas'])
    expect(explanation.explanation_sentence).toContain('2 of 3')
  })

  it('produces encouraging message for high score', () => {
    const opp         = makeOpp({ match_score: 90, matched_skills: ['python', 'sql', 'pandas'], missing_skills: [] })
    const explanation = buildMatchExplanation(opp)
    expect(explanation.explanation_sentence).toContain('strong fit')
  })

  it('produces growth message for low score', () => {
    const opp         = makeOpp({ match_score: 20, matched_skills: [], missing_skills: ['python', 'sql', 'pandas'] })
    const explanation = buildMatchExplanation(opp)
    expect(explanation.explanation_sentence).toContain('project')
  })
})

// ---------------------------------------------------------------------------
// sortByMatchScore
// ---------------------------------------------------------------------------
describe('sortByMatchScore', () => {
  it('sorts descending by match_score', () => {
    const opps = [
      makeOpp({ id: 'a', match_score: 40 }),
      makeOpp({ id: 'b', match_score: 80 }),
      makeOpp({ id: 'c', match_score: 60 }),
    ]
    const sorted = sortByMatchScore(opps)
    expect(sorted[0].id).toBe('b')
    expect(sorted[1].id).toBe('c')
    expect(sorted[2].id).toBe('a')
  })

  it('uses posted_at as tiebreaker for equal scores', () => {
    const opps = [
      makeOpp({ id: 'a', match_score: 70, posted_at: '2024-01-01T00:00:00Z' }),
      makeOpp({ id: 'b', match_score: 70, posted_at: '2024-06-01T00:00:00Z' }),
    ]
    const sorted = sortByMatchScore(opps)
    expect(sorted[0].id).toBe('b')  // More recent first
  })

  it('does not mutate original array', () => {
    const opps   = [makeOpp({ id: 'a', match_score: 40 }), makeOpp({ id: 'b', match_score: 80 })]
    const sorted = sortByMatchScore(opps)
    expect(opps[0].id).toBe('a')  // Original unchanged
    expect(sorted[0].id).toBe('b')
  })
})

// ---------------------------------------------------------------------------
// filterFeedLocally
// ---------------------------------------------------------------------------
describe('filterFeedLocally', () => {
  const opps = [
    makeOpp({ id: '1', category: 'Technology',  experience_level: 'Fresher', is_paid: true,  title: 'Python Developer' }),
    makeOpp({ id: '2', category: 'Finance',      experience_level: 'Junior',  is_paid: false, title: 'Data Analyst' }),
    makeOpp({ id: '3', category: 'Technology',  experience_level: 'Fresher', is_paid: true,  title: 'React Engineer' }),
  ]

  it('filters by category', () => {
    const filtered = filterFeedLocally(opps, { category: 'Finance' })
    expect(filtered.length).toBe(1)
    expect(filtered[0].id).toBe('2')
  })

  it('filters by experience_level', () => {
    const filtered = filterFeedLocally(opps, { experience_level: 'Junior' })
    expect(filtered.length).toBe(1)
  })

  it('filters by is_paid', () => {
    const filtered = filterFeedLocally(opps, { is_paid: false })
    expect(filtered.length).toBe(1)
    expect(filtered[0].id).toBe('2')
  })

  it('filters by search query (title + skills)', () => {
    const filtered = filterFeedLocally(opps, { search: 'python' })
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    expect(filtered.some((o: RankedOpportunity) => o.title.toLowerCase().includes('python'))).toBe(true)
  })

  it('returns all when no filters provided', () => {
    const filtered = filterFeedLocally(opps, {})
    expect(filtered.length).toBe(3)
  })

  it('combines multiple filters', () => {
    const filtered = filterFeedLocally(opps, { category: 'Technology', is_paid: true })
    expect(filtered.length).toBe(2)
    filtered.forEach((o: RankedOpportunity) => {
      expect(o.category).toBe('Technology')
      expect(o.is_paid).toBe(true)
    })
  })
})
