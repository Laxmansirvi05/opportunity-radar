import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase, eqValue, payloadOf, type QueryCall } from './helpers/fake-supabase'

const runTargetGeneration = vi.fn()
vi.mock('@/lib/resume-optimizer/run', () => ({
  runTargetGeneration: (...args: unknown[]) => runTargetGeneration(...args),
}))

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { GET, PATCH } = await import('@/app/api/resume/optimization/[id]/route')

const params = (id: string) => Promise.resolve({ id })

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/resume/optimization/run-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const suggestion = (id: string, completed: boolean) => ({
  id, type: 'skill', title: `Learn ${id}`, detail: 'x', requirement: id,
  importance: 'high', completed, completed_at: completed ? new Date().toISOString() : null,
})

describe('GET /api/resume/optimization/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); currentClient = null })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await GET(new NextRequest('http://x/run-1'), { params: params('run-1') })
    expect(res.status).toBe(401)
  })

  it('404s a run that does not belong to this user (RLS-equivalent check at the app layer too)', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ trail }) => {
        expect(eqValue(trail, 'id')).toBe('run-1')
        expect(eqValue(trail, 'user_id')).toBe('u1')
        return { data: null, error: { message: 'not found' } }
      },
    })
    const res = await GET(new NextRequest('http://x/run-1'), { params: params('run-1') })
    expect(res.status).toBe(404)
  })

  it('returns the run on success', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: { id: 'run-1', tier: 'full' }, error: null }) })
    const res = await GET(new NextRequest('http://x/run-1'), { params: params('run-1') })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.run.id).toBe('run-1')
  })
})

describe('PATCH /api/resume/optimization/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); currentClient = null })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await PATCH(patchReq({ suggestionId: 's1', completed: true }), { params: params('run-1') })
    expect(res.status).toBe(401)
  })

  it('400s a malformed body', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await PATCH(patchReq({ suggestionId: 123 }), { params: params('run-1') })
    expect(res.status).toBe(400)
  })

  it('404s a suggestion id that is not on the run', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({ data: { id: 'run-1', tier: 'full', suggestions: [suggestion('s1', false)] }, error: null }),
    })
    const res = await PATCH(patchReq({ suggestionId: 'does-not-exist', completed: true }), { params: params('run-1') })
    expect(res.status).toBe(404)
  })

  it('confirming the last suggestion on a full-tier run triggers Resume B and persists it', async () => {
    let updatePayload: Record<string, unknown> = {}
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ op, trail }) => {
        if (op === 'select') {
          return {
            data: {
              id: 'run-1', tier: 'full', target_resume: null, target_score: null,
              source_resume: { name: 'Jane' }, job_description: 'x'.repeat(120),
              target_role: 'Frontend Engineer', company_name: 'Acme',
              suggestions: [suggestion('s1', true), suggestion('s2', false)],
            },
            error: null,
          }
        }
        updatePayload = payloadOf(trail)
        return { data: { id: 'run-1', ...updatePayload }, error: null }
      },
    })
    runTargetGeneration.mockResolvedValue({ success: true, resume: { name: 'Jane', summary: 'aligned' }, score: 88 })

    const res = await PATCH(patchReq({ suggestionId: 's2', completed: true }), { params: params('run-1') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(runTargetGeneration).toHaveBeenCalledTimes(1)
    expect(runTargetGeneration).toHaveBeenCalledWith(expect.objectContaining({
      resume: { name: 'Jane' }, targetRole: 'Frontend Engineer', companyName: 'Acme',
    }))
    expect(updatePayload.target_score).toBe(88)
    expect(body.run.target_score).toBe(88)
  })

  it('does NOT attempt Resume B generation for a polish_only tier, even when the checklist becomes fully confirmed (unlocked=true)', async () => {
    // Deliberately fully confirmed here (unlocked would be true) — this
    // proves the tier check itself gates generation, not just the unlocked
    // check that would also happen to block a still-partial checklist.
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ op, trail }) => {
        if (op === 'select') {
          return {
            data: {
              id: 'run-1', tier: 'polish_only', target_resume: null, target_score: null,
              source_resume: {}, job_description: 'x', target_role: 'X', company_name: 'Y',
              suggestions: [suggestion('s1', false)],
            },
            error: null,
          }
        }
        return { data: { id: 'run-1', ...payloadOf(trail) }, error: null }
      },
    })

    const res = await PATCH(patchReq({ suggestionId: 's1', completed: true }), { params: params('run-1') })

    expect(res.status).toBe(200)
    expect(runTargetGeneration).not.toHaveBeenCalled()
  })

  it('un-confirming a suggestion after Resume B exists clears it rather than leaving a stale download', async () => {
    let updatePayload: Record<string, unknown> = {}
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ op, trail }) => {
        if (op === 'select') {
          return {
            data: {
              id: 'run-1', tier: 'full', target_resume: { name: 'Jane' }, target_score: 88,
              source_resume: {}, job_description: 'x', target_role: 'X', company_name: 'Y',
              suggestions: [suggestion('s1', true), suggestion('s2', true)],
            },
            error: null,
          }
        }
        updatePayload = payloadOf(trail)
        return { data: { id: 'run-1', ...updatePayload }, error: null }
      },
    })

    const res = await PATCH(patchReq({ suggestionId: 's1', completed: false }), { params: params('run-1') })

    expect(res.status).toBe(200)
    expect(updatePayload.target_resume).toBeNull()
    expect(updatePayload.target_score).toBeNull()
    expect(runTargetGeneration).not.toHaveBeenCalled()
  })

  it('surfaces a generation failure as a warning without failing the whole request', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: ({ op, trail }: QueryCall) => {
        if (op === 'select') {
          return {
            data: {
              id: 'run-1', tier: 'full', target_resume: null, target_score: null,
              source_resume: {}, job_description: 'x', target_role: 'X', company_name: 'Y',
              suggestions: [suggestion('s1', true)],
            },
            error: null,
          }
        }
        return { data: { id: 'run-1', ...payloadOf(trail) }, error: null }
      },
    })
    runTargetGeneration.mockResolvedValue({ success: false, error: 'fabrication detected twice' })

    const res = await PATCH(patchReq({ suggestionId: 's1', completed: true }), { params: params('run-1') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.warning).toBe('fabrication detected twice')
  })
})
