/**
 * Undo/redo history for the resume builder.
 *
 * Kept as pure functions rather than folded into `useResume` so the awkward
 * parts — coalescing, the redo branch being dropped, the cap — are testable
 * without rendering anything.
 *
 * Time is passed in as an argument instead of read from a clock, for the same
 * reason `createTapCounter` takes one: it makes every window-dependent case
 * expressible in a test without faking timers.
 */

/** Rapid successive edits inside this window collapse into one undo step. */
export const COALESCE_WINDOW_MS = 600

/**
 * Upper bound on undo steps. Each entry is a full resume snapshot, so this is
 * a memory ceiling as much as a UX one — deep enough to cover a normal edit
 * session, shallow enough that the retained objects stay small.
 */
export const HISTORY_LIMIT = 50

export interface EditHistory<T> {
  past: T[]
  present: T
  future: T[]
  /**
   * When the last edit was recorded. Set to -Infinity by undo/redo so the
   * next edit always starts a fresh step rather than coalescing into — and
   * silently overwriting — the state the user just navigated to.
   */
  lastRecordedAt: number
}

export function createEditHistory<T>(present: T): EditHistory<T> {
  return { past: [], present, future: [], lastRecordedAt: Number.NEGATIVE_INFINITY }
}

export function canUndo<T>(history: EditHistory<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: EditHistory<T>): boolean {
  return history.future.length > 0
}

interface RecordOptions {
  coalesceWindowMs?: number
  limit?: number
}

/**
 * Records an edit.
 *
 * Consecutive edits within the coalesce window replace the present value
 * without pushing a new step, so that a burst of keystrokes undoes as one
 * change rather than one character at a time. Any edit invalidates the redo
 * branch — that state is no longer reachable.
 */
export function recordEdit<T>(
  history: EditHistory<T>,
  next: T,
  at: number,
  { coalesceWindowMs = COALESCE_WINDOW_MS, limit = HISTORY_LIMIT }: RecordOptions = {}
): EditHistory<T> {
  // Nothing actually changed — don't burn an undo step on it.
  if (next === history.present) return history

  const coalesce =
    history.past.length > 0 && at - history.lastRecordedAt < coalesceWindowMs

  if (coalesce) {
    return { ...history, present: next, future: [], lastRecordedAt: at }
  }

  const past = [...history.past, history.present]
  // Drop the oldest steps once the cap is reached, keeping the most recent.
  if (past.length > limit) past.splice(0, past.length - limit)

  return { past, present: next, future: [], lastRecordedAt: at }
}

export function undoEdit<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canUndo(history)) return history

  const past = [...history.past]
  const present = past.pop() as T

  return {
    past,
    present,
    future: [history.present, ...history.future],
    lastRecordedAt: Number.NEGATIVE_INFINITY,
  }
}

export function redoEdit<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canRedo(history)) return history

  const [present, ...future] = history.future

  return {
    past: [...history.past, history.present],
    present,
    future,
    lastRecordedAt: Number.NEGATIVE_INFINITY,
  }
}
