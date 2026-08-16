import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase, payloadOf } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { GET, POST } = await import('@/app/api/notes/route')

function req(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(url, init)
}

describe('GET /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await GET(req('http://localhost/api/notes'))
    expect(res.status).toBe(401)
  })

  it('returns the caller\'s notes, reshaping the joined opportunity', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: [
          {
            id: 'n1', user_id: 'u1', title: 'Interview prep', content: 'Practice DSA', source: 'manual',
            opportunity_id: 'o1', application_id: null, tags: ['prep'], is_pinned: true, is_archived: false,
            created_at: '2026-08-16T00:00:00Z', updated_at: '2026-08-16T00:00:00Z',
            opportunities: { id: 'o1', title: 'SWE Intern', companies: { name: 'Google' } },
          },
        ],
        error: null,
      }),
    })

    const res = await GET(req('http://localhost/api/notes'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.notes).toHaveLength(1)
    expect(body.notes[0].opportunity).toEqual({ id: 'o1', title: 'SWE Intern', company_name: 'Google' })
    expect(body.notes[0].opportunities).toBeUndefined()
  })

  it('returns 500 when the query fails', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'boom' } }) })
    const res = await GET(req('http://localhost/api/notes'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await POST(req('http://localhost/api/notes', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('rejects a note with no title and no content before touching the database', async () => {
    let insertCalled = false
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.op === 'insert') insertCalled = true
        return { data: null, error: null }
      },
    })
    const res = await POST(req('http://localhost/api/notes', { method: 'POST', body: JSON.stringify({ title: '  ', content: '   ', source: 'robot' }) }))
    expect(res.status).toBe(400)
    expect(insertCalled).toBe(false)
  })

  it('creates a manual note and returns the reshaped result', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.op === 'insert') {
          return {
            data: {
              id: 'n1', user_id: 'u1', title: 'Test', content: 'Body', source: 'manual',
              opportunity_id: null, application_id: null, tags: [], is_pinned: false, is_archived: false,
              created_at: '2026-08-16T00:00:00Z', updated_at: '2026-08-16T00:00:00Z', opportunities: null,
            },
            error: null,
          }
        }
        return { data: null, error: null }
      },
    })

    const res = await POST(req('http://localhost/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Body' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.note.source).toBe('manual')
    expect(body.note.title).toBe('Test')
  })

  it('drops an application_id that does not belong to the caller instead of trusting it', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call) => {
        if (call.table === 'application_tracker') {
          // Ownership check finds nothing — this application_id isn't theirs.
          return { data: null, error: null }
        }
        if (call.op === 'insert') {
          const payload = payloadOf(call.trail)
          return {
            data: {
              id: 'n1', user_id: 'u1', title: '', content: 'x', source: 'robot',
              opportunity_id: null, application_id: payload.application_id ?? null, tags: [],
              is_pinned: false, is_archived: false, created_at: 't', updated_at: 't', opportunities: null,
            },
            error: null,
          }
        }
        return { data: null, error: null }
      },
    })

    const res = await POST(req('http://localhost/api/notes', {
      method: 'POST',
      body: JSON.stringify({ content: 'x', source: 'robot', application_id: 'someone-elses-app' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.note.application_id).toBeNull()
  })
})
