import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../app/api/resume/ats-check/route'

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ get: vi.fn(), set: vi.fn() })
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
  }),
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
  })
}))
vi.mock('@/lib/ai-gateway', () => ({
  callAI: vi.fn().mockResolvedValue({ success: true, content: '{}' })
}))

function createRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/resume/ats-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('ATS API Validation', () => {
  const validBody = {
    resumeId: '123',
    targetRole: 'Frontend Developer',
    companyName: 'Acme Corp',
    jobDescription: 'A'.repeat(150),
    jobUrl: 'https://acmecorp.com/jobs/1'
  }

  it('rejects missing target role', async () => {
    const req = createRequest({ ...validBody, targetRole: '' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Target role is required.')
  })

  it('rejects missing company name', async () => {
    const req = createRequest({ ...validBody, companyName: '   ' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Company name is required.')
  })

  it('treats a missing job description as resume-only mode, not a validation error', async () => {
    const req = createRequest({ ...validBody, jobDescription: '' })
    const res = await POST(req)
    // No JD means no targeted match was requested at all — this is a valid,
    // deliberate mode, not something to reject.
    expect(res.status).not.toBe(400)
  })

  it('rejects short job description (e.g., "frontend developer")', async () => {
    const req = createRequest({ ...validBody, jobDescription: 'frontend developer' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Please paste the full job description/)
  })

  it('rejects invalid job url when supplied', async () => {
    const req = createRequest({ ...validBody, jobUrl: 'not-a-url' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid Job URL.')
  })

  it('accepts valid request', async () => {
    const req = createRequest(validBody)
    const res = await POST(req)
    // Should get a 404 or 500 or 200 depending on mock, but NOT 400 validation error
    // It will actually fail trying to find the resume because our mock returns null for supabase,
    // so it might return 404 "Resume not found". Let's just check it's not 400.
    expect(res.status).not.toBe(400)
  })
})
