import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase, eqValue, payloadOf } from './helpers/fake-supabase'

/**
 * Tests the actual route handlers (not just the lib functions they call), so
 * the wiring between HTTP request, auth check, validation, Supabase queries
 * and response shape is proven rather than only traced by eye.
 */

const startOptimizationRun = vi.fn()
vi.mock('@/lib/resume-optimizer/run', () => ({
  startOptimizationRun: (...args: unknown[]) => startOptimizationRun(...args),
}))

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { POST, GET } = await import('@/app/api/resume/optimization/route')

const validJd = 'x'.repeat(120)

function postReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/resume/optimization', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/resume/optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 and calls nothing else when there is no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })

    const res = await POST(postReq({ jobDescription: validJd, targetRole: 'X', companyName: 'Y', resumeData: {} }))

    expect(res.status).toBe(401)
    expect(startOptimizationRun).not.toHaveBeenCalled()
  })

  it('rejects a job description under 100 characters with a specific message', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })

    const res = await POST(postReq({ jobDescription: 'too short', targetRole: 'X', companyName: 'Y', resumeData: {} }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/full job description/i)
    expect(startOptimizationRun).not.toHaveBeenCalled()
  })

  it('requires either resumeId or resumeData', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })

    const res = await POST(postReq({ jobDescription: validJd, targetRole: 'X', companyName: 'Y' }))
    expect(res.status).toBe(400)
  })

  it('404s when resumeId does not resolve to a parsed resume owned by this user', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({ data: null, error: { message: 'not found' } }),
    })

    const res = await POST(postReq({ jobDescription: validJd, targetRole: 'X', companyName: 'Y', resumeId: 'r1' }))
    expect(res.status).toBe(404)
    expect(startOptimizationRun).not.toHaveBeenCalled()
  })

  it('happy path: loads the resume by id scoped to the user, runs the optimisation, and persists everything', async () => {
    const parsedResume = { name: 'Jane', skills: [], experience: [], projects: [], education: [] }
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ table, op, trail }) => {
        if (table === 'resumes' && op === 'select') {
          expect(eqValue(trail, 'id')).toBe('r1')
          expect(eqValue(trail, 'user_id')).toBe('u1')
          return { data: { id: 'r1', parsed_data: parsedResume }, error: null }
        }
        if (table === 'resume_optimizations' && op === 'insert') {
          const payload = payloadOf(trail)
          expect(payload.user_id).toBe('u1')
          expect(payload.original_resume_id).toBe('r1')
          expect(payload.tier).toBe('full')
          return { data: { id: 'run-1', ...payload }, error: null }
        }
        return { data: null, error: null }
      },
    })

    startOptimizationRun.mockResolvedValue({
      success: true,
      result: {
        structuredJd: {}, baselineScore: 42, baselineReport: {}, tier: 'full', suggestions: [],
      },
    })

    const res = await POST(postReq({
      jobDescription: validJd, targetRole: 'Frontend Engineer', companyName: 'Acme', resumeId: 'r1',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.run.id).toBe('run-1')
    expect(startOptimizationRun).toHaveBeenCalledWith(expect.objectContaining({
      resume: parsedResume, userId: 'u1', targetRole: 'Frontend Engineer', companyName: 'Acme',
    }))
  })

  it('inline resumeData skips the resumes table lookup entirely', async () => {
    const inlineResume = { name: 'Jane', skills: [], experience: [], projects: [], education: [] }
    let resumesTableTouched = false
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ table, op, trail }) => {
        if (table === 'resumes') resumesTableTouched = true
        if (table === 'resume_optimizations' && op === 'insert') {
          const payload = payloadOf(trail)
          expect(payload.original_resume_id).toBeNull()
          return { data: { id: 'run-2', ...payload }, error: null }
        }
        return { data: null, error: null }
      },
    })
    startOptimizationRun.mockResolvedValue({
      success: true,
      result: { structuredJd: {}, baselineScore: 42, baselineReport: {}, tier: 'full', suggestions: [] },
    })

    const res = await POST(postReq({
      jobDescription: validJd, targetRole: 'X', companyName: 'Y', resumeData: inlineResume,
    }))

    expect(res.status).toBe(200)
    expect(resumesTableTouched).toBe(false)
  })

  it('returns 502 with the honest error when the orchestration fails, and never inserts a row', async () => {
    let insertCalled = false
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ table, op }) => {
        if (table === 'resume_optimizations' && op === 'insert') insertCalled = true
        return { data: null, error: null }
      },
    })
    startOptimizationRun.mockResolvedValue({ success: false, error: 'Could not analyse the job description.' })

    const res = await POST(postReq({ jobDescription: validJd, targetRole: 'X', companyName: 'Y', resumeData: { name: 'Jane Doe', skills: [], experience: [], projects: [], education: [] } }))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toBe('Could not analyse the job description.')
    expect(insertCalled).toBe(false)
  })

  it('returns 500 when scoring succeeded but the database write failed', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ table, op }) => {
        if (table === 'resume_optimizations' && op === 'insert') {
          return { data: null, error: { message: 'db down' } }
        }
        return { data: null, error: null }
      },
    })
    startOptimizationRun.mockResolvedValue({
      success: true,
      result: { structuredJd: {}, baselineScore: 42, baselineReport: {}, tier: 'full', suggestions: [] },
    })

    const res = await POST(postReq({ jobDescription: validJd, targetRole: 'X', companyName: 'Y', resumeData: { name: 'Jane Doe', skills: [], experience: [], projects: [], education: [] } }))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/resume/optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('lists only the authenticated user\'s runs', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ table, trail }) => {
        expect(table).toBe('resume_optimizations')
        expect(eqValue(trail, 'user_id')).toBe('u1')
        return { data: [{ id: 'run-1' }, { id: 'run-2' }], error: null }
      },
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.runs).toHaveLength(2)
  })

  it('returns 500 with an honest message when the list query fails', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'boom' } }) })
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
