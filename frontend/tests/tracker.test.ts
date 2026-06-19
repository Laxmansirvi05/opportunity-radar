import { describe, it, expect } from 'vitest'
import { buildKanbanBoard, computeInsertPosition, needsReNormalisation, reNormalisePositions } from '@/lib/tracker'
import type { ApplicationWithOpportunity } from '@/types/tracker'

function makeApp(overrides: Partial<ApplicationWithOpportunity>): ApplicationWithOpportunity {
  return {
    id:                      'app-1',
    user_id:                 'user-1',
    opportunity_id:          'opp-1',
    stage:                   'saved',
    ats_score_snapshot:      null,
    match_score_snapshot:    null,
    resume_version_id:       null,
    applied_at:              null,
    notes:                   null,
    custom_label:            null,
    column_position:         100,
    created_at:              '2024-01-01T00:00:00Z',
    updated_at:              '2024-01-01T00:00:00Z',
    opportunity_title:       'Software Engineer',
    opportunity_company:     null,
    opportunity_location:    null,
    opportunity_is_paid:     null,
    opportunity_deadline:    null,
    opportunity_apply_url:   'https://example.com',
    ...overrides,
  }
}

describe('buildKanbanBoard', () => {
  it('groups applications by stage', () => {
    const apps = [
      makeApp({ id: '1', stage: 'saved',   column_position: 100 }),
      makeApp({ id: '2', stage: 'applied', column_position: 100 }),
      makeApp({ id: '3', stage: 'saved',   column_position: 200 }),
    ]
    const board = buildKanbanBoard(apps)
    expect(board.saved.length).toBe(2)
    expect(board.applied.length).toBe(1)
    expect(board.interview.length).toBe(0)
  })

  it('sorts columns by column_position ascending', () => {
    const apps = [
      makeApp({ id: '1', stage: 'saved', column_position: 300 }),
      makeApp({ id: '2', stage: 'saved', column_position: 100 }),
      makeApp({ id: '3', stage: 'saved', column_position: 200 }),
    ]
    const board = buildKanbanBoard(apps)
    expect(board.saved[0].id).toBe('2')
    expect(board.saved[1].id).toBe('3')
    expect(board.saved[2].id).toBe('1')
  })
})

describe('computeInsertPosition', () => {
  it('returns 100 for empty column', () => {
    expect(computeInsertPosition(null, null)).toBe(100)
  })

  it('appends after last card', () => {
    const last = makeApp({ column_position: 300 })
    expect(computeInsertPosition(last, null)).toBe(400)
  })

  it('inserts midpoint between two cards', () => {
    const above = makeApp({ column_position: 100 })
    const below = makeApp({ column_position: 300 })
    expect(computeInsertPosition(above, below)).toBe(200)
  })
})

describe('needsReNormalisation', () => {
  it('returns false when gaps are sufficient', () => {
    const apps = [
      makeApp({ id: '1', column_position: 100 }),
      makeApp({ id: '2', column_position: 200 }),
    ]
    expect(needsReNormalisation(apps)).toBe(false)
  })

  it('returns true when gap < 1', () => {
    const apps = [
      makeApp({ id: '1', column_position: 100 }),
      makeApp({ id: '2', column_position: 100 }),  // Duplicate position = gap of 0
    ]
    expect(needsReNormalisation(apps)).toBe(true)
  })
})

describe('reNormalisePositions', () => {
  it('produces multiples of 100', () => {
    const apps = [
      makeApp({ id: '1', column_position: 50 }),
      makeApp({ id: '2', column_position: 51 }),
      makeApp({ id: '3', column_position: 52 }),
    ]
    const normalised = reNormalisePositions(apps)
    expect(normalised[0].position).toBe(100)
    expect(normalised[1].position).toBe(200)
    expect(normalised[2].position).toBe(300)
  })
})
