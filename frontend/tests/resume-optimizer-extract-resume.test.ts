import { describe, it, expect, vi, beforeEach } from 'vitest'

const callAI = vi.fn()
vi.mock('@/lib/ai-gateway', () => ({
  callAI: (...args: unknown[]) => callAI(...args),
}))

import { extractResumeFromText } from '@/lib/resume-optimizer/extract-resume'

const validResume = {
  name: 'Aarav Sharma',
  email: 'aarav@example.com',
  skills: ['React', 'TypeScript'],
  experience: [],
  projects: [],
  education: [{ institution: 'XYZ', degree: 'B.Tech', degree_level: 'bachelors' }],
}

describe('extractResumeFromText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a validated resume on success', async () => {
    callAI.mockResolvedValue({ success: true, content: JSON.stringify(validResume) })

    const result = await extractResumeFromText('some raw resume text', 'user-1')

    expect(result.success).toBe(true)
    expect(result.resume?.name).toBe('Aarav Sharma')
    expect(callAI).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: 'json' }),
      expect.objectContaining({ feature: 'resume_extraction', userId: 'user-1' })
    )
  })

  it('strips a fabricated gpa of exactly 0 rather than trusting it', async () => {
    callAI.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        ...validResume,
        education: [{ institution: 'XYZ', degree: 'B.Tech', degree_level: 'bachelors', gpa: 0 }],
      }),
    })

    const result = await extractResumeFromText('text', 'user-1')

    expect(result.success).toBe(true)
    expect(result.resume?.education[0].gpa).toBeUndefined()
  })

  it('keeps a real, non-zero gpa', async () => {
    callAI.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        ...validResume,
        education: [{ institution: 'XYZ', degree: 'B.Tech', degree_level: 'bachelors', gpa: 9.28 }],
      }),
    })

    const result = await extractResumeFromText('text', 'user-1')
    expect(result.resume?.education[0].gpa).toBe(9.28)
  })

  it('surfaces the gateway failure reason rather than a generic error', async () => {
    callAI.mockResolvedValue({ success: false, reason: 'all_failed' })

    const result = await extractResumeFromText('text', 'user-1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/all_failed/)
  })

  it('fails honestly rather than returning a resume when the AI output does not match the schema', async () => {
    callAI.mockResolvedValue({ success: true, content: '{"not": "a resume"}' })

    const result = await extractResumeFromText('text', 'user-1')

    expect(result.success).toBe(false)
    expect(result.resume).toBeUndefined()
  })

  it('repairs mildly malformed JSON (trailing comma) rather than failing outright', async () => {
    callAI.mockResolvedValue({
      success: true,
      content: `{"name": "Aarav Sharma", "skills": ["React",], "experience": [], "projects": [], "education": []}`,
    })

    const result = await extractResumeFromText('text', 'user-1')
    expect(result.success).toBe(true)
    expect(result.resume?.skills).toEqual(['React'])
  })
})
