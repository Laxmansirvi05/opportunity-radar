// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * `save()` backs the builder's "Download PDF" button, which renders the PDF
 * server-side from the saved `resumes.parsed_data` row. That makes two things
 * load-bearing that plain state could not give it:
 *
 *  1. it has to *return* the resume id — a brand-new resume only gets one at
 *     insert time, and the download can't wait for a re-render to read it; and
 *  2. saving twice in quick succession must UPDATE the row it just created,
 *     not INSERT a second resume. The id was previously copied into its ref
 *     by an effect, which does not run until after a render, so a save queued
 *     before then still saw a null id and created a duplicate.
 */

const createResume = vi.fn()
const updateResume = vi.fn()

vi.mock('@/features/resume-toolkit/services/resume-actions', () => ({
  createResume: (...args: unknown[]) => createResume(...args),
  updateResume: (...args: unknown[]) => updateResume(...args),
  getResumeBySlug: vi.fn(),
}))

const { useResume } = await import('@/features/resume-toolkit/hooks/use-resume')

beforeEach(() => {
  createResume.mockReset()
  updateResume.mockReset()
  createResume.mockResolvedValue({ success: true, id: 'resume-1', slug: 'my-resume' })
  updateResume.mockResolvedValue({ success: true })
})

describe('useResume().save()', () => {
  it('returns the id of a newly created resume', async () => {
    const { result } = renderHook(() => useResume())

    let saved: string | null = null
    await act(async () => {
      saved = await result.current.save()
    })

    expect(saved).toBe('resume-1')
    expect(createResume).toHaveBeenCalledTimes(1)
  })

  it('updates the existing row on a second save instead of creating a duplicate', async () => {
    const { result } = renderHook(() => useResume())

    await act(async () => {
      await result.current.save()
      // Deliberately inside the same act() — no render has flushed between the
      // two saves, which is exactly the window the duplicate-insert bug lived in.
      await result.current.save()
    })

    expect(createResume).toHaveBeenCalledTimes(1)
    expect(updateResume).toHaveBeenCalledTimes(1)
    expect(updateResume).toHaveBeenCalledWith('resume-1', expect.anything())
  })

  it('updates rather than inserts when the resume was loaded with an existing id', async () => {
    const { result } = renderHook(() => useResume({ initialId: 'resume-9' }))

    let saved: string | null = null
    await act(async () => {
      saved = await result.current.save()
    })

    expect(saved).toBe('resume-9')
    expect(createResume).not.toHaveBeenCalled()
    expect(updateResume).toHaveBeenCalledWith('resume-9', expect.anything())
  })

  it('resolves to null when the save fails, so callers do not act on a bad id', async () => {
    createResume.mockResolvedValue({ success: false })
    const { result } = renderHook(() => useResume())

    let saved: string | null = 'unset'
    await act(async () => {
      saved = await result.current.save()
    })

    expect(saved).toBeNull()
    expect(result.current.saveStatus).toBe('error')
  })

  it('resolves to null when the save throws rather than rejecting', async () => {
    createResume.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useResume())

    let saved: string | null = 'unset'
    await act(async () => {
      saved = await result.current.save()
    })

    expect(saved).toBeNull()
    expect(result.current.saveStatus).toBe('error')
  })
})
