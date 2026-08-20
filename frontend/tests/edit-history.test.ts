import { describe, it, expect } from 'vitest'
import {
  createEditHistory,
  recordEdit,
  undoEdit,
  redoEdit,
  canUndo,
  canRedo,
  COALESCE_WINDOW_MS,
  HISTORY_LIMIT,
} from '@/features/resume-toolkit/lib/edit-history'

/**
 * Backs the resume builder's Undo/Redo buttons. Time is passed in rather than
 * read from a clock, so every coalescing case below is expressible without
 * faking timers.
 */

/** Records edits far enough apart that none of them coalesce. */
function recordSpaced<T>(initial: T, values: T[]) {
  let history = createEditHistory(initial)
  let at = 0
  for (const value of values) {
    at += COALESCE_WINDOW_MS * 2
    history = recordEdit(history, value, at)
  }
  return history
}

describe('createEditHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createEditHistory('a')
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })
})

describe('recordEdit', () => {
  it('makes the previous value undoable', () => {
    const history = recordSpaced('a', ['b'])
    expect(history.present).toBe('b')
    expect(canUndo(history)).toBe(true)
    expect(undoEdit(history).present).toBe('a')
  })

  it('ignores an edit that does not change the value', () => {
    const history = createEditHistory('a')
    expect(recordEdit(history, 'a', 100)).toBe(history)
  })

  it('collapses a burst of edits into a single undo step', () => {
    // What typing looks like: many edits, none more than a keystroke apart.
    let history = createEditHistory('')
    let at = 0
    for (const value of ['J', 'Ja', 'Jan', 'Jane']) {
      at += 50
      history = recordEdit(history, value, at)
    }

    expect(history.present).toBe('Jane')
    // One step back is the empty string the user started from — not 'Jan'.
    expect(history.past).toEqual([''])
    expect(undoEdit(history).present).toBe('')
  })

  it('starts a new step once the coalesce window has passed', () => {
    let history = recordEdit(createEditHistory('a'), 'b', 0)
    history = recordEdit(history, 'c', COALESCE_WINDOW_MS + 1)

    expect(undoEdit(history).present).toBe('b')
    expect(undoEdit(undoEdit(history)).present).toBe('a')
  })

  it('drops the redo branch — an edit makes the redone future unreachable', () => {
    const history = undoEdit(recordSpaced('a', ['b', 'c']))
    expect(canRedo(history)).toBe(true)

    const edited = recordEdit(history, 'd', 10_000)
    expect(canRedo(edited)).toBe(false)
    expect(edited.future).toEqual([])
  })

  it('caps history at the limit, discarding the oldest steps', () => {
    const values = Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => `v${i}`)
    const history = recordSpaced('start', values)

    expect(history.past).toHaveLength(HISTORY_LIMIT)
    // 'start' and the earliest edits have aged out; the recent ones remain.
    expect(history.past).not.toContain('start')
    expect(history.past.at(-1)).toBe(`v${values.length - 2}`)
  })
})

describe('undoEdit / redoEdit', () => {
  it('walks back and forward through several steps', () => {
    const history = recordSpaced('a', ['b', 'c'])

    const back = undoEdit(undoEdit(history))
    expect(back.present).toBe('a')

    const forward = redoEdit(redoEdit(back))
    expect(forward.present).toBe('c')
  })

  it('is a no-op at either end rather than throwing', () => {
    const empty = createEditHistory('a')
    expect(undoEdit(empty)).toBe(empty)
    expect(redoEdit(empty)).toBe(empty)
  })

  it('does not coalesce the first edit made after an undo', () => {
    // Regression guard: undo leaves lastRecordedAt in the past, so an edit
    // arriving moments later must still open its own step -- coalescing here
    // would overwrite the state the user just undid back to, losing it.
    const history = undoEdit(recordEdit(createEditHistory('a'), 'b', 1_000))
    expect(history.present).toBe('a')

    const edited = recordEdit(history, 'c', 1_010) // well inside the window
    expect(edited.present).toBe('c')
    expect(undoEdit(edited).present).toBe('a')
  })

  it('round-trips back to the same value after undo then redo', () => {
    const history = recordSpaced('a', ['b'])
    expect(redoEdit(undoEdit(history)).present).toBe('b')
  })
})
