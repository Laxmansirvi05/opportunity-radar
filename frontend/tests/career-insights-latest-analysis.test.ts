import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeFakeSupabase } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { getLatestAnalysis, getFullHistory } = await import('@/features/resume-toolkit/services/career-insights')

describe('getLatestAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns null for a signed-out request', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    expect(await getLatestAnalysis()).toBeNull()
  })

  it('returns null for a first-time user with no ATS report and no optimiser run', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    expect(await getLatestAnalysis()).toBeNull()
  })

  it('picks the Optimiser run when it is newer than the ATS report', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.table === 'resume_ats_reports') {
          return { data: { id: 'ats1', score: 40, created_at: '2026-08-01T00:00:00Z', target_job_description: 'Old JD', report_data: { suggestions: [] } }, error: null }
        }
        if (call.table === 'resume_optimizations') {
          return {
            data: {
              id: 'opt1', baseline_score: 70, target_role: 'Frontend Developer', company_name: 'Acme',
              tier: 'full', suggestions: [{ title: 'Build a React project', importance: 'high' }],
              created_at: '2026-08-10T00:00:00Z',
            },
            error: null,
          }
        }
        return { data: null, error: null }
      },
    })

    const result = await getLatestAnalysis()
    expect(result?.kind).toBe('optimizer')
    if (result?.kind !== 'optimizer') return
    expect(result.score).toBe(70)
    expect(result.targetRole).toBe('Frontend Developer')
    expect(result.topSuggestions).toEqual([{ title: 'Build a React project', importance: 'high' }])
  })

  it('picks the ATS report when it is newer than the Optimiser run', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.table === 'resume_ats_reports') {
          return {
            data: {
              id: 'ats2', score: 55, created_at: '2026-08-12T00:00:00Z',
              target_job_description: 'Backend Engineer role requiring Node.js and PostgreSQL experience',
              report_data: { suggestions: [{ title: 'Add Docker experience', importance: 'medium' }] },
            },
            error: null,
          }
        }
        if (call.table === 'resume_optimizations') {
          return { data: { id: 'opt2', baseline_score: 70, target_role: 'X', company_name: 'Y', tier: 'full', suggestions: [], created_at: '2026-08-01T00:00:00Z' }, error: null }
        }
        return { data: null, error: null }
      },
    })

    const result = await getLatestAnalysis()
    expect(result?.kind).toBe('ats')
    if (result?.kind !== 'ats') return
    expect(result.score).toBe(55)
    expect(result.jobLabel).toMatch(/Backend Engineer/)
    expect(result.topSuggestions).toEqual([{ title: 'Add Docker experience', importance: 'medium' }])
  })

  it('falls back to whichever of the two exists when the other has no rows yet', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.table === 'resume_optimizations') {
          return { data: { id: 'opt3', baseline_score: 62, target_role: 'X', company_name: 'Y', tier: 'polish_only', suggestions: [], created_at: '2026-08-05T00:00:00Z' }, error: null }
        }
        return { data: null, error: null }
      },
    })

    const result = await getLatestAnalysis()
    expect(result?.kind).toBe('optimizer')
  })
})

describe('getFullHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns empty, never-merged lists for a signed-out request', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const result = await getFullHistory()
    expect(result).toEqual({ ats: [], optimizer: [] })
  })

  it('keeps ATS and Optimiser history as two separate, never-merged lists', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.table === 'resume_ats_reports') {
          return {
            data: [
              { id: 'ats1', score: 40, created_at: '2026-08-01T00:00:00Z', target_job_description: 'Backend Engineer role' },
            ],
            error: null,
          }
        }
        if (call.table === 'resume_optimizations') {
          return {
            data: [
              { id: 'opt1', baseline_score: 70, target_role: 'Frontend Developer', company_name: 'Acme', tier: 'full', created_at: '2026-08-10T00:00:00Z' },
            ],
            error: null,
          }
        }
        return { data: null, error: null }
      },
    })

    const result = await getFullHistory()
    expect(result.ats).toHaveLength(1)
    expect(result.optimizer).toHaveLength(1)
    expect(result.ats[0]).toMatchObject({ id: 'ats1', score: 40 })
    expect(result.optimizer[0]).toMatchObject({ id: 'opt1', baselineScore: 70, targetRole: 'Frontend Developer' })
  })
})
