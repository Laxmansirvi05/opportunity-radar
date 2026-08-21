import { describe, it, expect } from 'vitest'
import { matchLevelForScore } from '@/features/ai-search/lib/match-label'

/**
 * The results card shows a band instead of the agent's raw 0–100 score: "90"
 * reads as a precision the score does not have, and two points of difference
 * between two model judgements is noise a student should not be weighing.
 */
describe('matchLevelForScore', () => {
  it('names each band', () => {
    expect(matchLevelForScore(95).label).toBe('Excellent match')
    expect(matchLevelForScore(85).label).toBe('Strong match')
    expect(matchLevelForScore(70).label).toBe('Good match')
    expect(matchLevelForScore(55).label).toBe('Worth a look')
  })

  it('places the boundaries on the band they name', () => {
    expect(matchLevelForScore(90).label).toBe('Excellent match')
    expect(matchLevelForScore(89).label).toBe('Strong match')
    expect(matchLevelForScore(78).label).toBe('Strong match')
    expect(matchLevelForScore(77).label).toBe('Good match')
    expect(matchLevelForScore(65).label).toBe('Good match')
    expect(matchLevelForScore(64).label).toBe('Worth a look')
  })

  /** Never a discouraging label on a result the agent chose to surface. */
  it('never labels a shown result as a poor one', () => {
    for (const score of [0, 10, 40, 64]) {
      expect(matchLevelForScore(score).label).toBe('Worth a look')
    }
  })

  it('degrades to the neutral band rather than throwing on a missing score', () => {
    expect(matchLevelForScore(null).label).toBe('Worth a look')
    expect(matchLevelForScore(undefined).label).toBe('Worth a look')
    expect(matchLevelForScore(Number.NaN).label).toBe('Worth a look')
  })

  it('carries styling for every band', () => {
    for (const score of [95, 85, 70, 55]) {
      expect(matchLevelForScore(score).className).toMatch(/bg-/)
    }
  })

  it('never puts a number in the label', () => {
    for (const score of [0, 55, 65, 78, 90, 100]) {
      expect(matchLevelForScore(score).label).not.toMatch(/\d/)
      expect(matchLevelForScore(score).label).not.toContain('%')
    }
  })
})
