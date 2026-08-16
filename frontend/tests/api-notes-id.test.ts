import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

const { PATCH, DELETE } = await import('@/app/api/notes/[id]/route')

function call(id: string, body?: unknown) {
  const r = new NextRequest(`http://localhost/api/notes/${id}`, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { req: r, params: Promise.resolve({ id }) }
}

const EXISTING = { id: 'n1', title: 'Old title', content: 'Old content' }

describe('PATCH /api/notes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const { req, params } = call('n1', { title: 'x' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 for a note that does not exist or belongs to another user', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const { req, params } = call('missing', { title: 'x' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(404)
  })

  it('updates title/content and returns the reshaped note', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (c) => {
        if (c.op === 'select') return { data: EXISTING, error: null }
        return {
          data: {
            id: 'n1', user_id: 'u1', title: 'New title', content: 'New content', source: 'manual',
            opportunity_id: null, application_id: null, tags: [], is_pinned: false, is_archived: false,
            created_at: 't', updated_at: 't2', opportunities: null,
          },
          error: null,
        }
      },
    })
    const { req, params } = call('n1', { title: 'New title', content: 'New content' })
    const res = await PATCH(req, { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.note.title).toBe('New title')
  })

  it('deletes the row instead of saving when the edit empties both title and content', async () => {
    let deleteCalled = false
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (c) => {
        if (c.op === 'select') return { data: EXISTING, error: null }
        if (c.op === 'delete') {
          deleteCalled = true
          return { data: null, error: null }
        }
        return { data: null, error: null }
      },
    })
    const { req, params } = call('n1', { title: '   ', content: '' })
    const res = await PATCH(req, { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(true)
    expect(deleteCalled).toBe(true)
  })

  it('a pin/archive-only patch does not empty-check or touch text at all', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (c) => {
        if (c.op === 'select') return { data: EXISTING, error: null }
        return {
          data: {
            id: 'n1', user_id: 'u1', title: EXISTING.title, content: EXISTING.content, source: 'manual',
            opportunity_id: null, application_id: null, tags: [], is_pinned: true, is_archived: false,
            created_at: 't', updated_at: 't2', opportunities: null,
          },
          error: null,
        }
      },
    })
    const { req, params } = call('n1', { is_pinned: true })
    const res = await PATCH(req, { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.note.is_pinned).toBe(true)
  })
})

describe('DELETE /api/notes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentClient = null
  })

  it('returns 401 with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const { params } = call('n1')
    const res = await DELETE(new NextRequest('http://localhost/api/notes/n1', { method: 'DELETE' }), { params })
    expect(res.status).toBe(401)
  })

  it('deletes and returns success', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const { params } = call('n1')
    const res = await DELETE(new NextRequest('http://localhost/api/notes/n1', { method: 'DELETE' }), { params })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 when the delete itself fails', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'boom' } }) })
    const { params } = call('n1')
    const res = await DELETE(new NextRequest('http://localhost/api/notes/n1', { method: 'DELETE' }), { params })
    expect(res.status).toBe(500)
  })
})
