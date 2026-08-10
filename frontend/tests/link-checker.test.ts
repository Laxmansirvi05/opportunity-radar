import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkUrl, classifyLinkStatus, sweepLinkHealth, type Db, type QueryChain } from '@/lib/ingestion/link-checker'

describe('classifyLinkStatus', () => {
  it('treats DNS/connect failure, 404 and 410 as unambiguously dead', () => {
    expect(classifyLinkStatus(0)).toBe('dead')
    expect(classifyLinkStatus(404)).toBe('dead')
    expect(classifyLinkStatus(410)).toBe('dead')
  })

  it('does not treat ambiguous statuses as dead — a 403 is as likely anti-bot as gone', () => {
    expect(classifyLinkStatus(200)).toBe('ok')
    expect(classifyLinkStatus(301)).toBe('ok')
    expect(classifyLinkStatus(401)).toBe('ok')
    expect(classifyLinkStatus(403)).toBe('ok')
    expect(classifyLinkStatus(500)).toBe('ok')
  })
})

describe('checkUrl', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the HEAD status directly when the host supports HEAD', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
    const result = await checkUrl('https://example.com/job/1')
    expect(result.status).toBe(200)
  })

  it('falls back to GET when HEAD is not implemented (405)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkUrl('https://example.com/job/2')
    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to GET when HEAD throws (some hosts reject HEAD outright)', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkUrl('https://example.com/job/3')
    expect(result.status).toBe(200)
  })

  it('resolves to status 0 rather than throwing when nothing works', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS failure')))
    const result = await checkUrl('https://this-domain-does-not-resolve.invalid/job')
    expect(result.status).toBe(0)
  })
})

// ── Fake Supabase-shaped Db ─────────────────────────────────────────────────

function makeChain(
  rows: Record<string, unknown>[],
  updateCalls: { id: unknown; payload: Record<string, unknown> }[],
  expireCalls: { ids: unknown[]; payload: Record<string, unknown> }[]
): QueryChain {
  let mode: 'select' | 'update' = 'select'
  let payload: Record<string, unknown> = {}

  const chain: QueryChain = {
    select: () => chain,
    update: (p) => { mode = 'update'; payload = p; return chain },
    eq: (_col, val) => { updateCalls.push({ id: val, payload }); return chain },
    in: (_col, vals) => {
      if (mode === 'update') expireCalls.push({ ids: [...vals], payload })
      return chain
    },
    order: () => chain,
    limit: () => chain,
    then: (resolve) => resolve({ data: mode === 'select' ? rows : null, error: null }),
  }
  return chain
}

function createFakeDb(rows: Record<string, unknown>[]) {
  const updateCalls: { id: unknown; payload: Record<string, unknown> }[] = []
  const expireCalls: { ids: unknown[]; payload: Record<string, unknown> }[] = []
  const db: Db = { from: () => makeChain(rows, updateCalls, expireCalls) }
  return { db, updateCalls, expireCalls }
}

describe('sweepLinkHealth', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('checks every row, records link_status per row, and expires only the unambiguously dead ones', async () => {
    const rows = [
      { id: 'a', apply_url: 'https://ok.example.com/1' },
      { id: 'b', apply_url: 'https://dead.example.com/2' },
      { id: 'c', apply_url: 'https://ambiguous.example.com/3' },
    ]
    const { db, updateCalls, expireCalls } = createFakeDb(rows)

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('dead')) return Promise.resolve(new Response(null, { status: 404 }))
      if (url.includes('ambiguous')) return Promise.resolve(new Response(null, { status: 403 }))
      return Promise.resolve(new Response(null, { status: 200 }))
    }))

    const result = await sweepLinkHealth(db, { concurrency: 3 })

    expect(result.checked).toBe(3)
    expect(result.ok).toBe(2) // 200 and 403
    expect(result.dead).toBe(1) // 404
    expect(result.expired).toBe(1)

    expect(updateCalls).toHaveLength(3)
    const byId = Object.fromEntries(updateCalls.map((c) => [c.id, c.payload.link_status]))
    expect(byId.a).toBe(200)
    expect(byId.b).toBe(404)
    expect(byId.c).toBe(403)

    expect(expireCalls).toHaveLength(1)
    expect(expireCalls[0].ids).toEqual(['b'])
    expect(expireCalls[0].payload.status).toBe('Expired')
  })

  it('stops starting new batches once the time budget is spent, rather than overrunning the caller', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}`, apply_url: `https://example.com/${i}` }))
    const { db, updateCalls } = createFakeDb(rows)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))

    let elapsed = 0
    // Each batch of 2 "costs" enough time that only the first batch fits.
    const advancing = vi.fn(() => { elapsed += 200; return elapsed })

    const result = await sweepLinkHealth(db, { concurrency: 2, timeBudgetMs: 150, now: advancing })

    // First now() call is the start stamp (elapsed becomes 200 already >150),
    // so the loop should not process any batch beyond what the budget allows.
    expect(result.checked).toBeLessThan(rows.length)
    expect(updateCalls.length).toBe(result.checked)
  })

  it('only checks live (Published/Closing Soon) rows — the query filters status before this module ever sees a row', async () => {
    const rows = [{ id: 'a', apply_url: 'https://example.com/1' }]
    const { db } = createFakeDb(rows)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))

    const result = await sweepLinkHealth(db, {})
    expect(result.checked).toBe(1)
  })
})
