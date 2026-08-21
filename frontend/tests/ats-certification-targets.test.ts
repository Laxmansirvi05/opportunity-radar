import { describe, it, expect } from 'vitest'
import {
  selectCertificationTargets,
  pickBestCertification,
  MAX_CERTIFICATION_CARDS,
} from '@/lib/ats-checker/certification-targets'
import type { GapSuggestion } from '@/features/resume-toolkit/lib/schema/resume/ats-check'

/**
 * Picks which JD requirements the ATS results page looks for certifications
 * against. The count deliberately reuses the gap checklist's own
 * score-scaled budget so the two halves of the page never disagree about how
 * much work a resume needs.
 */

function gap(over: Partial<GapSuggestion> = {}): GapSuggestion {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    type: 'skill',
    title: 'Learn it',
    detail: 'detail',
    requirement: 'React',
    importance: 'high',
    completed: false,
    ...over,
  } as GapSuggestion
}

describe('selectCertificationTargets', () => {
  it('returns the requirement names, in checklist order', () => {
    const targets = selectCertificationTargets(
      [gap({ requirement: 'React' }), gap({ requirement: 'TypeScript' })],
      50
    )
    expect(targets).toEqual(['React', 'TypeScript'])
  })

  it('scales the count with the score, the way the gap checklist does', () => {
    const many = Array.from({ length: 8 }, (_, i) => gap({ requirement: `Skill ${i}` }))
    // A near-ready resume gets a short list; a struggling one gets more.
    expect(selectCertificationTargets(many, 85)).toHaveLength(2)
    expect(selectCertificationTargets(many, 70)).toHaveLength(3)
    expect(selectCertificationTargets(many, 55)).toHaveLength(4)
  })

  it('never exceeds the card cap even at the lowest scores', () => {
    const many = Array.from({ length: 12 }, (_, i) => gap({ requirement: `Skill ${i}` }))
    // The checklist budget goes to 5 down here; the cards stop at the cap.
    expect(selectCertificationTargets(many, 10).length).toBe(MAX_CERTIFICATION_CARDS)
  })

  /**
   * Regression: `project` was excluded at first, on the reasoning that
   * building closes it rather than enrolling. But typeForCategory maps
   * technical_capability and tooling_environment — most of a backend job
   * description — onto `project`, so a real backend resume produced no
   * certifications at all.
   */
  it('includes technical gaps, which arrive typed as project', () => {
    const targets = selectCertificationTargets(
      [
        gap({ type: 'project', requirement: 'Docker' }),
        gap({ type: 'project', requirement: 'MongoDB' }),
        gap({ type: 'certification', requirement: 'AWS' }),
        gap({ type: 'education', requirement: 'Statistics' }),
      ],
      50
    )
    expect(targets).toEqual(['Docker', 'MongoDB', 'AWS', 'Statistics'])
  })

  it('skips gaps the student has already ticked off', () => {
    const targets = selectCertificationTargets(
      [gap({ requirement: 'React', completed: true }), gap({ requirement: 'Docker' })],
      50
    )
    expect(targets).toEqual(['Docker'])
  })

  it('never lets one requirement claim two cards', () => {
    // The checklist can raise the same requirement as both a skill and a course.
    const targets = selectCertificationTargets(
      [
        gap({ type: 'skill', requirement: 'Kubernetes' }),
        gap({ type: 'course', requirement: 'kubernetes' }),
        gap({ type: 'course', requirement: 'Docker' }),
      ],
      50
    )
    expect(targets).toEqual(['Kubernetes', 'Docker'])
  })

  it('drops blank requirements rather than searching for nothing', () => {
    const targets = selectCertificationTargets(
      [gap({ requirement: '   ' }), gap({ requirement: 'Docker' })],
      50
    )
    expect(targets).toEqual(['Docker'])
  })

  it('returns nothing when there are no gaps at all', () => {
    expect(selectCertificationTargets([], 50)).toEqual([])
  })

  it('returns nothing when every gap is already completed', () => {
    expect(
      selectCertificationTargets([gap({ completed: true }), gap({ completed: true })], 50)
    ).toEqual([])
  })
})

/**
 * Guards the pairing quality. Against the live catalogue, taking the search's
 * first row gave a Kubernetes course for "Docker" and "Master Dialogflow CX
 * Agents" for "Node.js" — the search ORs a stemmed full-text match with an
 * ilike and orders by price/title, not relevance.
 */
describe('pickBestCertification', () => {
  const cert = (id: string, title: string, over: Partial<{ topics: string[] | null; is_free: boolean }> = {}) => ({
    id,
    title,
    topics: over.topics ?? null,
    is_free: over.is_free ?? false,
  })

  it('rejects candidates that do not mention the requirement at all', () => {
    const picked = pickBestCertification(
      [cert('a', 'Kubernetes Training for Beginner'), cert('b', 'Master Dialogflow CX Agents')],
      'Docker'
    )
    expect(picked).toBeNull()
  })

  it('prefers a title match over a merely topical one', () => {
    const picked = pickBestCertification(
      [cert('topic', 'Cloud Foundations', { topics: ['Docker', 'CI/CD'] }), cert('title', 'Docker Registries')],
      'Docker'
    )
    expect(picked?.id).toBe('title')
  })

  it('accepts a topic match when no title matches', () => {
    const picked = pickBestCertification(
      [cert('a', 'Unrelated Course'), cert('b', 'Cloud Foundations', { topics: ['Docker'] })],
      'Docker'
    )
    expect(picked?.id).toBe('b')
  })

  it('prefers the free option between two equally good title matches', () => {
    const picked = pickBestCertification(
      [cert('paid', 'Docker Deep Dive', { is_free: false }), cert('free', 'Docker Deep Dive', { is_free: true })],
      'Docker'
    )
    expect(picked?.id).toBe('free')
  })

  it('matches case-insensitively', () => {
    expect(pickBestCertification([cert('a', 'typescript operators')], 'TypeScript')?.id).toBe('a')
  })

  it('returns null for an empty requirement or no candidates', () => {
    expect(pickBestCertification([cert('a', 'Docker')], '   ')).toBeNull()
    expect(pickBestCertification([], 'Docker')).toBeNull()
  })
})
