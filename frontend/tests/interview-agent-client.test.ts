/**
 * Tests for the interview agent-client utilities:
 * - serializeResumeToText  (Reactive Resume ResumeData → plain text)
 * - serializeParsedResumeToText  (uploaded PDF ParsedResume → plain text)
 * - buildJobDescriptionText  (opportunity row → JD text)
 * - messageForCode / ERROR_COPY  (student-facing error strings)
 */
import { describe, it, expect } from 'vitest'
import {
  serializeResumeToText,
  serializeParsedResumeToText,
  buildJobDescriptionText,
  messageForCode,
  ERROR_COPY,
} from '@/lib/interview/agent-client'

// ── serializeResumeToText ───────────────────────────────────────────────

describe('serializeResumeToText', () => {
  const base = (overrides = {}) =>
    ({
      basics: { name: 'Alice', headline: 'Engineer', email: 'a@b.co', phone: '+1', location: 'NYC' },
      summary: { content: 'A short summary.', hidden: false },
      sections: {
        experience: {
          hidden: false,
          items: [
            { hidden: false, position: 'SWE', company: 'Acme', period: '2024', description: 'Built things.' },
          ],
        },
        education: {
          hidden: false,
          items: [
            { hidden: false, degree: 'BS', area: 'CS', school: 'MIT', period: '2020' },
          ],
        },
        skills: {
          hidden: false,
          items: [
            { hidden: false, name: 'React', proficiency: 'Advanced' },
            { hidden: false, name: 'Python', proficiency: null },
          ],
        },
        certifications: {
          hidden: false,
          items: [
            { hidden: false, title: 'AWS SAA', issuer: 'Amazon', date: '2024' },
          ],
        },
        awards: {
          hidden: false,
          items: [
            { hidden: false, title: 'Hackathon Winner', awarder: 'TechCrunch', date: '2023' },
          ],
        },
        projects: {
          hidden: false,
          items: [
            { hidden: false, name: 'Portfolio', period: '2024', description: 'My site.' },
          ],
        },
      },
      ...overrides,
    }) as Parameters<typeof serializeResumeToText>[0]

  it('includes all sections when present', () => {
    const text = serializeResumeToText(base())
    expect(text).toContain('Alice')
    expect(text).toContain('SUMMARY')
    expect(text).toContain('EXPERIENCE')
    expect(text).toContain('EDUCATION')
    expect(text).toContain('PROJECTS')
    expect(text).toContain('SKILLS')
    expect(text).toContain('CERTIFICATIONS')
    expect(text).toContain('AWARDS')
  })

  it('includes skill proficiency', () => {
    const text = serializeResumeToText(base())
    expect(text).toContain('React (Advanced)')
    expect(text).toContain('Python')
    expect(text).not.toContain('Python (')
  })

  it('omits hidden sections', () => {
    const data = base({
      sections: {
        ...base().sections,
        skills: { hidden: true, items: [{ hidden: false, name: 'React' }] },
      },
    })
    const text = serializeResumeToText(data)
    expect(text).not.toContain('SKILLS')
  })

  it('omits hidden items within a section', () => {
    const data = base({
      sections: {
        ...base().sections,
        experience: {
          hidden: false,
          items: [
            { hidden: true, position: 'Secret', company: 'Hidden', period: '2020' },
            { hidden: false, position: 'Visible', company: 'Shown', period: '2024' },
          ],
        },
      },
    })
    const text = serializeResumeToText(data)
    expect(text).not.toContain('Secret')
    expect(text).toContain('Visible')
  })

  it('strips HTML from rich-text fields', () => {
    const data = base({
      sections: {
        ...base().sections,
        experience: {
          hidden: false,
          items: [
            { hidden: false, position: 'SWE', company: 'Co', description: '<p>Built <strong>REST</strong>&nbsp;APIs</p>' },
          ],
        },
      },
    })
    const text = serializeResumeToText(data)
    expect(text).toContain('Built REST APIs')
    expect(text).not.toContain('<p>')
    expect(text).not.toContain('<strong>')
  })

  it('produces empty string for fully empty resume', () => {
    const data = { basics: {}, sections: {} } as unknown as Parameters<typeof serializeResumeToText>[0]
    const text = serializeResumeToText(data)
    expect(text).toBe('')
  })
})

// ── serializeParsedResumeToText ─────────────────────────────────────────

describe('serializeParsedResumeToText', () => {
  it('formats a complete parsed resume', () => {
    const text = serializeParsedResumeToText({
      name: 'Bob',
      email: 'bob@co.com',
      phone: '+91',
      summary: 'Full-stack dev.',
      experience: [
        {
          role: 'Backend',
          company: 'Corp',
          start_date: '2022',
          end_date: '2024',
          location: 'Remote',
          bullets: ['Shipped features', 'Wrote tests'],
        },
      ],
      education: [{ degree: 'MS', degree_level: 'masters' as const, field: 'CS', institution: 'Stanford', graduation_year: 2022 }],
      skills: ['Go', 'TypeScript'],
      projects: [{ name: 'CLI', technologies: ['Go'], description: 'A CLI tool.' }],
      certifications: ['GCP Associate'],
      achievements: ['Dean list'],
    } as unknown as Parameters<typeof serializeParsedResumeToText>[0])

    expect(text).toContain('Bob')
    expect(text).toContain('EXPERIENCE')
    expect(text).toContain('Shipped features')
    expect(text).toContain('EDUCATION')
    expect(text).toContain('SKILLS')
    expect(text).toContain('Go, TypeScript')
    expect(text).toContain('PROJECTS')
    expect(text).toContain('CERTIFICATIONS')
    expect(text).toContain('ACHIEVEMENTS')
  })

  it('handles missing optional fields', () => {
    const text = serializeParsedResumeToText({
      name: 'Minimal',
    } as Parameters<typeof serializeParsedResumeToText>[0])
    expect(text).toBe('Minimal')
  })
})

// ── buildJobDescriptionText ─────────────────────────────────────────────

describe('buildJobDescriptionText', () => {
  it('concatenates all parts', () => {
    const text = buildJobDescriptionText({
      title: 'Backend Engineer',
      description: 'Build APIs.',
      skills: ['Go', 'SQL'],
      responsibilities: ['Design systems', 'Code review'],
    })
    expect(text).toContain('Backend Engineer')
    expect(text).toContain('Build APIs.')
    expect(text).toContain('Skills: Go, SQL')
    expect(text).toContain('Responsibilities: Design systems; Code review')
  })

  it('works with only a title', () => {
    const text = buildJobDescriptionText({
      title: 'Designer',
      description: null,
      skills: null,
      responsibilities: null,
    })
    expect(text).toBe('Designer')
  })
})

// ── messageForCode ──────────────────────────────────────────────────────

describe('messageForCode', () => {
  it('returns the correct copy for known codes', () => {
    expect(messageForCode('AGENT_UNREACHABLE')).toBe(ERROR_COPY.AGENT_UNREACHABLE)
    expect(messageForCode('SESSION_NOT_FOUND')).toBe(ERROR_COPY.SESSION_NOT_FOUND)
    expect(messageForCode('NO_RESUME')).toBe(ERROR_COPY.NO_RESUME)
  })

  it('falls back to INTERNAL_ERROR for unknown codes', () => {
    expect(messageForCode('SOMETHING_WEIRD')).toBe(ERROR_COPY.INTERNAL_ERROR)
    expect(messageForCode(undefined)).toBe(ERROR_COPY.INTERNAL_ERROR)
  })
})
