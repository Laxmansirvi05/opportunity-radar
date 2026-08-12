import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeFakeSupabase } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { listResumes } = await import('@/features/resume-toolkit/services/resume-actions')

describe('listResumes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('falls back to file_name when parsed_data has no usable name', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [
          { id: 'r1', file_name: 'my_resume_final_v2.pdf', parsed_data: null, created_at: 't', updated_at: 't' },
        ],
        error: null,
      }),
    })

    const result = await listResumes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.resumes[0].title).toBe('my_resume_final_v2.pdf')
  })

  it('falls back to "Untitled Resume" only when neither a parsed name nor a file name exists', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [{ id: 'r1', file_name: null, parsed_data: null, created_at: 't', updated_at: 't' }],
        error: null,
      }),
    })

    const result = await listResumes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.resumes[0].title).toBe('Untitled Resume')
  })

  it('uses the parsed candidate name over a placeholder file_name, in both flat and builder-shape parsed_data', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [
          { id: 'r1', file_name: 'Untitled Resume', parsed_data: { name: 'Laxman Sirvi', skills: [], experience: [], projects: [], education: [] }, created_at: 't1', updated_at: 't1' },
          { id: 'r2', file_name: 'Untitled Resume', parsed_data: { basics: { name: 'Aarav Sharma' }, sections: {} }, created_at: 't2', updated_at: 't2' },
        ],
        error: null,
      }),
    })

    const result = await listResumes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.resumes[0].title).toBe('Laxman Sirvi')
    expect(result.resumes[1].title).toBe('Aarav Sharma')
    // Also carries the normalized resume so the client can open a preview
    // without a second fetch, regardless of which shape parsed_data was in.
    expect(result.resumes[0].parsedResume?.name).toBe('Laxman Sirvi')
    expect(result.resumes[1].parsedResume?.name).toBe('Aarav Sharma')
  })

  it('returns a null parsedResume when parsed_data is absent, rather than throwing', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [{ id: 'r1', file_name: 'resume.pdf', parsed_data: null, created_at: 't', updated_at: 't' }],
        error: null,
      }),
    })

    const result = await listResumes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.resumes[0].parsedResume).toBeNull()
  })

  it('does not surface the internal "Unknown Candidate" placeholder as a title', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [
          { id: 'r1', file_name: 'resume.pdf', parsed_data: { basics: {}, sections: {} }, created_at: 't', updated_at: 't' },
        ],
        error: null,
      }),
    })

    const result = await listResumes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.resumes[0].title).toBe('resume.pdf')
  })
})
