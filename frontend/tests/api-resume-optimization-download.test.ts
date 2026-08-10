import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeFakeSupabase } from './helpers/fake-supabase'

let currentClient: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => currentClient,
}))

// renderResumePdf itself is exercised for real here (it's fast and already
// unit-tested for content correctness in tests/resume-optimizer-pdf.test.ts)
// so this test proves the route actually streams real PDF bytes with the
// right headers, not a mocked stand-in.
const { GET } = await import('@/app/api/resume/optimization/[id]/download/route')

const params = (id: string) => Promise.resolve({ id })
const req = (variant?: string) =>
  new NextRequest(`http://localhost:3000/x/download${variant ? `?variant=${variant}` : ''}`)

describe('GET /api/resume/optimization/[id]/download', () => {
  beforeEach(() => { vi.clearAllMocks(); currentClient = null })

  it('400s an invalid or missing variant before touching auth or the database', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: null }) })
    const res = await GET(req('nonsense'), { params: params('run-1') })
    expect(res.status).toBe(400)
  })

  it('401s with no session', async () => {
    currentClient = makeFakeSupabase({ userId: null, responder: () => ({ data: null, error: null }) })
    const res = await GET(req('polished'), { params: params('run-1') })
    expect(res.status).toBe(401)
  })

  it('404s a run that does not belong to this user', async () => {
    currentClient = makeFakeSupabase({ userId: 'u1', responder: () => ({ data: null, error: { message: 'not found' } }) })
    const res = await GET(req('polished'), { params: params('run-1') })
    expect(res.status).toBe(404)
  })

  it('404s the target variant with an honest reason when it has not been generated yet', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({ data: { polished_resume: { name: 'Jane' }, target_resume: null }, error: null }),
    })
    const res = await GET(req('target'), { params: params('run-1') })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toMatch(/confirm every item/i)
  })

  it('never substitutes the other variant when the requested one is missing', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({ data: { polished_resume: null, target_resume: { name: 'Jane' } }, error: null }),
    })
    const res = await GET(req('polished'), { params: params('run-1') })
    expect(res.status).toBe(404)
  })

  it('streams a real PDF with the right headers for the polished variant', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: { polished_resume: { name: 'Jane Doe', skills: [], experience: [], projects: [], education: [] }, target_resume: null },
        error: null,
      }),
    })

    const res = await GET(req('polished'), { params: params('run-1') })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="Jane-Doe-polished.pdf"')

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Buffer.from(bytes.slice(0, 5)).toString('utf-8')).toBe('%PDF-')
  })

  it('sanitises an unsafe name into a safe filename', async () => {
    currentClient = makeFakeSupabase({
      userId: 'u1',
      responder: () => ({
        data: {
          polished_resume: null,
          target_resume: { name: '../../etc/passwd; rm -rf', skills: [], experience: [], projects: [], education: [] },
        },
        error: null,
      }),
    })

    const res = await GET(req('target'), { params: params('run-1') })
    const disposition = res.headers.get('Content-Disposition') ?? ''

    expect(disposition).not.toContain('/')
    expect(disposition).not.toContain('..')
    expect(disposition).toMatch(/filename="[a-z0-9-]+-target\.pdf"/i)
  })
})
