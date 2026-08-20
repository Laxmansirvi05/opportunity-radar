// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * The note autosave engine creates a draft row on the first keystroke and
 * PATCHes it from then on. The case worth pinning down is what happens when a
 * save is still in flight: a debounce tick calls createNote, and before the
 * network returns the composer closes and flushes. Both saves would otherwise
 * see a null id and create their own row, leaving the user with a duplicate.
 *
 * A long debounce is used throughout so that saves happen only when the test
 * calls flush() — otherwise a 0ms timer fires mid-test and the call counts
 * stop meaning anything.
 */

const createNote = vi.fn()
const updateNote = vi.fn()
const deleteNote = vi.fn()

vi.mock('@/features/notes/services/notes-client', () => ({
  createNote: (...args: unknown[]) => createNote(...args),
  updateNote: (...args: unknown[]) => updateNote(...args),
  deleteNote: (...args: unknown[]) => deleteNote(...args),
}))

const { useAutosaveNote } = await import('@/features/notes/hooks/use-autosave-note')

/** A promise the test resolves by hand, to hold a save open. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

const note = (over: Record<string, unknown> = {}) =>
  ({ id: 'note-1', title: 'T', content: '<p>c</p>', ...over }) as never

const NEVER_AUTO = 10_000
const withDraft = {
  note: null,
  source: 'manual' as const,
  draft: { title: 'Draft', content: '<p>x</p>' },
  debounceMs: NEVER_AUTO,
}

beforeEach(() => {
  createNote.mockReset()
  updateNote.mockReset()
  deleteNote.mockReset()
  createNote.mockResolvedValue(note())
  updateNote.mockImplementation(async (id: string) => note({ id }))
  deleteNote.mockResolvedValue(undefined)
})

describe('useAutosaveNote', () => {
  it('creates the draft row on the first save', async () => {
    const { result } = renderHook(() => useAutosaveNote(withDraft))

    await act(async () => { await result.current.flush() })

    expect(createNote).toHaveBeenCalledTimes(1)
    expect(result.current.noteId).toBe('note-1')
    expect(result.current.status).toBe('saved')
  })

  it('updates rather than re-creating once the draft exists', async () => {
    const { result } = renderHook(() => useAutosaveNote(withDraft))

    await act(async () => { await result.current.flush() })
    await act(async () => { await result.current.flush() })

    expect(createNote).toHaveBeenCalledTimes(1)
    expect(updateNote).toHaveBeenCalledTimes(1)
    expect(updateNote).toHaveBeenCalledWith('note-1', expect.anything())
  })

  /**
   * The regression this file exists for. Without the persist queue the second
   * flush starts while createNote is still pending, sees a null id, and
   * creates a duplicate note.
   */
  it('does not create a second note when a flush lands mid-create', async () => {
    const pending = deferred<ReturnType<typeof note>>()
    createNote.mockReturnValueOnce(pending.promise)

    const { result } = renderHook(() => useAutosaveNote(withDraft))

    await act(async () => {
      const inFlight = result.current.flush()
      const duringFlight = result.current.flush()
      pending.resolve(note())
      await Promise.all([inFlight, duringFlight])
    })

    expect(createNote).toHaveBeenCalledTimes(1)
    // The overlapping save became an update of the row the first one created.
    expect(updateNote).toHaveBeenCalledTimes(1)
  })

  it('deletes the draft instead of saving an emptied note', async () => {
    const { result } = renderHook(() =>
      useAutosaveNote({ note: note(), source: 'manual', debounceMs: NEVER_AUTO })
    )

    await act(async () => {
      result.current.setTitle('')
      result.current.setContent('')
    })
    await act(async () => { await result.current.flush() })

    expect(deleteNote).toHaveBeenCalledWith('note-1')
    expect(updateNote).not.toHaveBeenCalled()
    expect(result.current.noteId).toBeNull()
  })

  it('never creates a row for a note that was empty all along', async () => {
    const { result } = renderHook(() =>
      useAutosaveNote({ note: null, source: 'manual', debounceMs: NEVER_AUTO })
    )

    await act(async () => { await result.current.flush() })

    expect(createNote).not.toHaveBeenCalled()
    expect(deleteNote).not.toHaveBeenCalled()
  })

  it('reports an error status when the save fails', async () => {
    createNote.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useAutosaveNote(withDraft))

    await act(async () => { await result.current.flush() })

    expect(result.current.status).toBe('error')
  })

  it('keeps saving after a failed save rather than wedging the queue', async () => {
    createNote.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAutosaveNote(withDraft))

    await act(async () => { await result.current.flush() })
    expect(result.current.status).toBe('error')

    createNote.mockResolvedValue(note())
    await act(async () => { await result.current.flush() })

    expect(result.current.status).toBe('saved')
  })
})
