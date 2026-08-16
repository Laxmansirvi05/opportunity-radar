import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase, payloadOf } from './helpers/fake-supabase'
import type { QueryCall } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

// The share route resolves other users' profiles through a service-role client
// (profiles SELECT RLS is own-row-only). Mocked so the tests never need real
// credentials and never touch the network.
const adminResponses = { profileByEmail: null as { id: string } | null, profiles: [] as unknown[] }
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'in', 'ilike', 'eq']
      for (const m of methods) chain[m] = () => chain
      chain.maybeSingle = async () => ({ data: adminResponses.profileByEmail, error: null })
      chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: adminResponses.profiles, error: null })
      return chain
    },
  }),
}))

const folders = await import('@/app/api/notes/folders/route')
const folderById = await import('@/app/api/notes/folders/[id]/route')
const bulk = await import('@/app/api/notes/bulk/route')
const share = await import('@/app/api/notes/[id]/share/route')
const links = await import('@/app/api/notes/[id]/links/route')
const attachments = await import('@/app/api/notes/attachments/route')

function req(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(url, init)
}

function json(url: string, method: string, body: unknown) {
  return req(url, { method, body: JSON.stringify(body) })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  currentClient = null
  adminResponses.profileByEmail = null
  adminResponses.profiles = []
})

describe('the auth boundary holds on every workspace route', () => {
  it('401s without a session, before touching the database', async () => {
    const cases: [string, () => Promise<Response>][] = [
      ['GET /folders', () => folders.GET()],
      ['POST /folders', () => folders.POST(json('http://localhost/api/notes/folders', 'POST', { name: 'X' }))],
      ['PATCH /folders', () => folders.PATCH(json('http://localhost/api/notes/folders', 'PATCH', { order: [] }))],
      ['PATCH /folders/[id]', () => folderById.PATCH(json('http://localhost/api/notes/folders/f1', 'PATCH', { name: 'X' }), params('f1'))],
      ['DELETE /folders/[id]', () => folderById.DELETE(req('http://localhost/api/notes/folders/f1', { method: 'DELETE' }), params('f1'))],
      ['POST /bulk', () => bulk.POST(json('http://localhost/api/notes/bulk', 'POST', { ids: ['n1'], action: 'pin' }))],
      ['GET /share', () => share.GET(req('http://localhost/api/notes/n1/share'), params('n1'))],
      ['PUT /share', () => share.PUT(json('http://localhost/api/notes/n1/share', 'PUT', { link_access: 'view' }), params('n1'))],
      ['GET /links', () => links.GET(req('http://localhost/api/notes/n1/links'), params('n1'))],
      ['GET /attachments', () => attachments.GET(req('http://localhost/api/notes/attachments'))],
    ]

    for (const [label, call] of cases) {
      currentClient = makeFakeSupabase({
        userId: null,
        responder: () => {
          throw new Error(`${label} queried the database without a session`)
        },
      })
      const res = await call()
      expect(res.status, label).toBe(401)
    }
  })
})

describe('POST /api/notes/folders', () => {
  it('rejects a folder with no name', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await folders.POST(json('http://localhost/api/notes/folders', 'POST', { name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('falls back to a valid colour rather than storing whatever was sent', async () => {
    let inserted: Record<string, unknown> | null = null
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        if (call.op === 'insert') {
          inserted = payloadOf(call.trail) as Record<string, unknown>
          return { data: { id: 'f1', name: 'X', color: 'blue', icon: null, parent_id: null, position: 0 }, error: null }
        }
        return { data: null, error: null }
      },
    })

    const res = await folders.POST(
      json('http://localhost/api/notes/folders', 'POST', { name: 'X', color: 'chartreuse' })
    )
    expect(res.status).toBe(200)
    expect(inserted!.color).toBe('blue')
  })

  it('turns a duplicate name into a 409 rather than a raw Postgres error', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) =>
        call.op === 'insert'
          ? { data: null, error: { code: '23505', message: 'duplicate key' } }
          : { data: null, error: null },
    })

    const res = await folders.POST(json('http://localhost/api/notes/folders', 'POST', { name: 'Skills' }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/notes/folders/[id]', () => {
  it('refuses a colour outside the palette', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await folderById.PATCH(
      json('http://localhost/api/notes/folders/f1', 'PATCH', { color: 'neon' }),
      params('f1')
    )
    expect(res.status).toBe(400)
  })

  it('refuses to make a folder its own parent', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await folderById.PATCH(
      json('http://localhost/api/notes/folders/f1', 'PATCH', { parent_id: 'f1' }),
      params('f1')
    )
    expect(res.status).toBe(400)
  })

  it('refuses a move that would put a folder inside its own descendant', async () => {
    // f2's parent is f1, so moving f1 under f2 would detach both from the tree.
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        const eq = call.trail.find((c) => c.op === 'eq' && c.args[0] === 'id')
        if (eq?.args[1] === 'f2') return { data: { parent_id: 'f1' }, error: null }
        return { data: { parent_id: null }, error: null }
      },
    })

    const res = await folderById.PATCH(
      json('http://localhost/api/notes/folders/f1', 'PATCH', { parent_id: 'f2' }),
      params('f1')
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/inside itself/i)
  })
})

describe('POST /api/notes/bulk', () => {
  it('rejects an unknown action', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await bulk.POST(json('http://localhost/api/notes/bulk', 'POST', { ids: ['n1'], action: 'incinerate' }))
    expect(res.status).toBe(400)
  })

  it('trashes by setting deleted_at, never by deleting the row', async () => {
    let update: Record<string, unknown> | null = null
    let sawDelete = false
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        if (call.op === 'update') update = payloadOf(call.trail) as Record<string, unknown>
        if (call.op === 'delete') sawDelete = true
        return { data: null, error: null }
      },
    })

    const res = await bulk.POST(json('http://localhost/api/notes/bulk', 'POST', { ids: ['n1', 'n2'], action: 'trash' }))
    expect(res.status).toBe(200)
    expect(sawDelete).toBe(false)
    expect(typeof update!.deleted_at).toBe('string')
  })

  it('restores by clearing deleted_at', async () => {
    let update: Record<string, unknown> | null = null
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        if (call.op === 'update') update = payloadOf(call.trail) as Record<string, unknown>
        return { data: null, error: null }
      },
    })

    await bulk.POST(json('http://localhost/api/notes/bulk', 'POST', { ids: ['n1'], action: 'restore' }))
    expect(update!.deleted_at).toBeNull()
  })

  it('scopes every bulk write to the caller', async () => {
    let trail: QueryCall['trail'] = []
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        if (call.op === 'update') trail = call.trail
        return { data: null, error: null }
      },
    })

    await bulk.POST(json('http://localhost/api/notes/bulk', 'POST', { ids: ['n1'], action: 'pin' }))
    expect(trail.some((c) => c.op === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'u1')).toBe(true)
  })
})

describe('PUT /api/notes/[id]/share', () => {
  it('refuses an edit-by-link level that the backend cannot enforce', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({ data: { id: 'n1' }, error: null }),
    })

    const res = await share.PUT(
      json('http://localhost/api/notes/n1/share', 'PUT', { link_access: 'edit' }),
      params('n1')
    )
    expect(res.status).toBe(400)
  })

  it('404s when the note is not the caller\'s own', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await share.PUT(
      json('http://localhost/api/notes/n1/share', 'PUT', { link_access: 'view' }),
      params('n1')
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/notes/[id]/share (recipients)', () => {
  it('reports a clean 404 when the email has no account', async () => {
    adminResponses.profileByEmail = null
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: { id: 'n1' }, error: null }) })

    const res = await share.POST(
      json('http://localhost/api/notes/n1/share', 'POST', { email: 'nobody@example.com', permission: 'view' }),
      params('n1')
    )
    expect(res.status).toBe(404)
  })

  it('refuses to share a note with its own owner', async () => {
    adminResponses.profileByEmail = { id: 'u1' }
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: { id: 'n1' }, error: null }) })

    const res = await share.POST(
      json('http://localhost/api/notes/n1/share', 'POST', { email: 'me@example.com', permission: 'edit' }),
      params('n1')
    )
    expect(res.status).toBe(400)
  })

  it('defaults an unrecognised permission to view rather than edit', async () => {
    adminResponses.profileByEmail = { id: 'u2' }
    let upserted: Record<string, unknown> | null = null
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        if (call.op === 'upsert') upserted = payloadOf(call.trail) as Record<string, unknown>
        return { data: { id: 'n1' }, error: null }
      },
    })

    await share.POST(
      json('http://localhost/api/notes/n1/share', 'POST', { email: 'them@example.com', permission: 'admin' }),
      params('n1')
    )
    expect(upserted!.permission).toBe('view')
  })
})

describe('POST /api/notes/[id]/links', () => {
  it('rejects an unknown target type', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: { id: 'n1' }, error: null }) })
    const res = await links.POST(
      json('http://localhost/api/notes/n1/links', 'POST', { target_type: 'planet', target_id: 'x' }),
      params('n1')
    )
    expect(res.status).toBe(400)
  })

  it('refuses a note linking to itself', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: { id: 'n1' }, error: null }) })
    const res = await links.POST(
      json('http://localhost/api/notes/n1/links', 'POST', { target_type: 'note', target_id: 'n1' }),
      params('n1')
    )
    expect(res.status).toBe(400)
  })

  it('404s when the link target is not the caller\'s own note', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: (call: QueryCall) => {
        // The source note resolves; the target does not.
        const eq = call.trail.find((c) => c.op === 'eq' && c.args[0] === 'id')
        if (eq?.args[1] === 'n1') return { data: { id: 'n1' }, error: null }
        return { data: null, error: null }
      },
    })

    const res = await links.POST(
      json('http://localhost/api/notes/n1/links', 'POST', { target_type: 'note', target_id: 'someone-elses' }),
      params('n1')
    )
    expect(res.status).toBe(404)
  })
})
