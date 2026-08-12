import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { GET: listGET } = await import('@/app/api/resume/ats-history/route')
const { GET: itemGET } = await import('@/app/api/resume/ats-history/[id]/route')

describe('GET /api/resume/ats-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await listGET()
    expect(res.status).toBe(401)
  })

  it('summarises stored reports without leaking the full report_data blob', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [
          { id: 'r1', score: 62.4, created_at: '2026-08-10T00:00:00Z', target_job_description: 'Backend Engineer requiring Node.js' },
          { id: 'r2', score: 30, created_at: '2026-08-01T00:00:00Z', target_job_description: '' },
        ],
        error: null,
      }),
    })

    const res = await listGET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reports).toHaveLength(2)
    expect(body.reports[0]).toEqual({ id: 'r1', score: 62, createdAt: '2026-08-10T00:00:00Z', jobLabel: 'Backend Engineer requiring Node.js' })
    // An empty job description (resume-only check) gets an honest label, not a blank string.
    expect(body.reports[1].jobLabel).toBe('Resume-only check')
  })

  it('returns 500 with a clear message when the query itself fails', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'boom' } }) })
    const res = await listGET()
    expect(res.status).toBe(500)
  })
})

describe('GET /api/resume/ats-history/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  function req(id: string) {
    return { req: new NextRequest(`http://localhost:3000/api/resume/ats-history/${id}`), params: { params: Promise.resolve({ id }) } }
  }

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const { req: r, params } = req('r1')
    const res = await itemGET(r, params)
    expect(res.status).toBe(401)
  })

  it('returns 404 for a report that does not exist or belongs to another user', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'not found' } }) })
    const { req: r, params } = req('missing')
    const res = await itemGET(r, params)
    expect(res.status).toBe(404)
  })

  it('returns the stored report_data verbatim, ready to feed straight into the live result view', async () => {
    const storedReport = { mode: 'targeted', readiness: {}, suggestions: [{ title: 'x', importance: 'high' }] }
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: { id: 'r1', score: 55, created_at: '2026-08-10T00:00:00Z', target_job_description: 'JD text', report_data: storedReport },
        error: null,
      }),
    })

    const { req: r, params } = req('r1')
    const res = await itemGET(r, params)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.report).toEqual(storedReport)
    expect(body.score).toBe(55)
  })
})
