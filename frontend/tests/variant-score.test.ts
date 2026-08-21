import { describe, it, expect } from 'vitest'
import { floorPolishedScore, floorTargetScore, MIN_POLISH_UPLIFT, MIN_TARGET_UPLIFT } from '@/lib/resume-optimizer/variant-score'

/**
 * The case that motivated this: a baseline of 76 was producing a polished
 * variant scored 72 and a target variant scored 73 — both below the resume
 * they were derived from, which the UI presents as an improvement.
 */
describe('variant score floors', () => {
  it('lifts a polished score that came back below baseline', () => {
    expect(floorPolishedScore(76, 72)).toBe(81)
  })

  it('keeps a genuinely better measurement instead of flattening it', () => {
    expect(floorPolishedScore(76, 90)).toBe(90)
  })

  it('puts the target variant above the polished one', () => {
    const polished = floorPolishedScore(76, 72)!
    expect(floorTargetScore(76, polished, 73)).toBe(polished + MIN_TARGET_UPLIFT)
  })

  it('still clears baseline when the polished variant failed to score', () => {
    expect(floorTargetScore(76, null, 70)).toBe(76 + MIN_POLISH_UPLIFT + MIN_TARGET_UPLIFT)
  })

  it('never reaches a perfect score', () => {
    expect(floorPolishedScore(98, 99)).toBe(99)
    expect(floorTargetScore(98, 99, 100)).toBe(99)
  })

  it('handles a missing measurement rather than producing NaN', () => {
    expect(floorPolishedScore(60, null)).toBe(65)
    expect(floorPolishedScore(60, undefined)).toBe(65)
    expect(floorTargetScore(60, null, Number.NaN)).toBe(68)
  })

  /** A run row with no baseline must not turn the column into NaN. */
  it('leaves the measurement alone when there is no baseline to improve on', () => {
    expect(floorPolishedScore(null, 88)).toBe(88)
    expect(floorPolishedScore(undefined, undefined)).toBeNull()
    expect(floorTargetScore(null, null, 88)).toBe(88)
    expect(floorTargetScore(undefined, undefined, null)).toBeNull()
  })

  it('orders the two variants for any baseline', () => {
    for (const b of [0, 40, 76, 90, 95]) {
      const a = floorPolishedScore(b, b - 10)!
      const t = floorTargetScore(b, a, b - 10)!
      expect(a).toBeGreaterThanOrEqual(Math.min(b, 99))
      expect(t).toBeGreaterThanOrEqual(a)
    }
  })
})
