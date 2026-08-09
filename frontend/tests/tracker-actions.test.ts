import { describe, it, expect } from 'vitest'
import { TRACKER_STAGES } from '@/features/tracker/actions/tracker-actions'
import { PROTECTED_TRACKER_STAGES } from '@/lib/ingestion/reconciliation'

/**
 * The tracker's stage vocabulary is shared across three places: the board
 * columns, the server action's validation, and the reconciliation policy that
 * decides which applications survive an expired listing. If they drift, an
 * expired opportunity a student already applied to could be silently deleted.
 */
describe('tracker stages', () => {
  it('exposes the five stages in pipeline order', () => {
    expect([...TRACKER_STAGES]).toEqual([
      'Saved',
      'Applied',
      'Interview Scheduled',
      'Selected',
      'Rejected',
    ])
  })

  it('matches the stages reconciliation protects from deletion', () => {
    // Everything except "Saved" represents real student effort and must be kept
    // when the underlying listing expires.
    const expectedProtected = TRACKER_STAGES.filter((s) => s !== 'Saved')
    expect([...PROTECTED_TRACKER_STAGES].sort()).toEqual([...expectedProtected].sort())
  })

  it('protects every stage a student can reach after applying', () => {
    for (const stage of ['Applied', 'Interview Scheduled', 'Selected', 'Rejected']) {
      expect(PROTECTED_TRACKER_STAGES as readonly string[]).toContain(stage)
    }
    // "Saved" is deliberately unprotected: an expired listing the student never
    // acted on should disappear from their board.
    expect(PROTECTED_TRACKER_STAGES as readonly string[]).not.toContain('Saved')
  })
})
