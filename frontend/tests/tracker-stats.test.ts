import { describe, expect, it } from 'vitest'
import { computeTrackerStats } from '@/features/tracker/stats'
import { isTrackerStage, TRACKER_STAGES } from '@/features/tracker/stages'

const items = (statuses: string[]) => statuses.map((status) => ({ status }))

describe('computeTrackerStats', () => {
  it('returns an empty summary with null response rate for an empty board', () => {
    expect(computeTrackerStats([])).toEqual({
      total: 0,
      applied: 0,
      interviewing: 0,
      offers: 0,
      responseRate: null,
    })
  })

  it('counts Saved toward total but not toward applications or response rate', () => {
    const stats = computeTrackerStats(items(['Saved', 'Saved', 'Saved']))
    expect(stats.total).toBe(3)
    expect(stats.applied).toBe(0)
    // No applications yet -> "—", not a misleading 0%.
    expect(stats.responseRate).toBeNull()
  })

  it('treats every post-Saved stage as an application', () => {
    const stats = computeTrackerStats(
      items(['Saved', 'Applied', 'Interview Scheduled', 'Selected', 'Rejected'])
    )
    expect(stats.total).toBe(5)
    expect(stats.applied).toBe(4) // Applied + Interview + Selected + Rejected
    expect(stats.interviewing).toBe(1)
    expect(stats.offers).toBe(1)
  })

  it('counts interviews, offers AND rejections as responses (a rejection is still a reply)', () => {
    // 3 responses (interview, offer, rejected) out of 4 applications = 75%.
    const stats = computeTrackerStats(
      items(['Applied', 'Interview Scheduled', 'Selected', 'Rejected'])
    )
    expect(stats.responseRate).toBe(75)
  })

  it('is 0% when applications exist but none got a response', () => {
    expect(computeTrackerStats(items(['Applied', 'Applied'])).responseRate).toBe(0)
  })

  it('is 100% when every application got a response', () => {
    const stats = computeTrackerStats(items(['Interview Scheduled', 'Selected', 'Rejected']))
    expect(stats.responseRate).toBe(100)
  })

  it('rounds to the nearest whole percent', () => {
    // 1 response / 3 applications = 33.33% -> 33
    expect(computeTrackerStats(items(['Applied', 'Applied', 'Selected'])).responseRate).toBe(33)
    // 2 / 3 = 66.67% -> 67
    expect(computeTrackerStats(items(['Applied', 'Selected', 'Rejected'])).responseRate).toBe(67)
  })

  it('changes as an application progresses — the metric is not static', () => {
    const before = computeTrackerStats(items(['Applied', 'Applied']))
    const after = computeTrackerStats(items(['Applied', 'Interview Scheduled']))
    expect(before.responseRate).toBe(0)
    expect(after.responseRate).toBe(50)
  })

  it('ignores unknown status values (counts them only in total)', () => {
    const stats = computeTrackerStats(items(['Applied', 'Ghosted' as string]))
    expect(stats.total).toBe(2)
    expect(stats.applied).toBe(1)
  })
})

describe('isTrackerStage', () => {
  it('accepts exactly the five board stages', () => {
    for (const s of TRACKER_STAGES) expect(isTrackerStage(s)).toBe(true)
  })

  it('rejects unknown or lower-cased values', () => {
    expect(isTrackerStage('applied')).toBe(false) // DB CHECK is case-sensitive
    expect(isTrackerStage('Offer')).toBe(false)
    expect(isTrackerStage('')).toBe(false)
  })
})
