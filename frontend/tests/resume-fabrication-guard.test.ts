import { describe, it, expect } from 'vitest'
import { verifyNoFabrication, extractMetrics } from '@/lib/resume-optimizer/fabrication-guard'
import type { ParsedResume } from '@/types/resume'

const SOURCE: ParsedResume = {
  name: 'Aarav Mehta',
  email: 'aarav@example.com',
  summary: 'Computer science student with web development experience.',
  skills: ['React', 'JavaScript', 'CSS'],
  experience: [
    {
      company: 'Nimbus Labs',
      role: 'Frontend Intern',
      start_date: '2024-06',
      end_date: '2024-12',
      bullets: ['Built dashboard components and improved page load time by 30%.'],
    },
  ],
  projects: [{ name: 'Portfolio Site', description: 'Personal website', technologies: ['React'] }],
  education: [
    {
      institution: 'State University',
      degree: 'B.Tech',
      degree_level: 'bachelors',
      field: 'Computer Science',
      graduation_year: 2026,
      gpa: 8.1,
    },
  ],
}

const clone = (): ParsedResume => JSON.parse(JSON.stringify(SOURCE))

describe('rewording is allowed', () => {
  it('passes a resume whose wording changed but whose facts did not', () => {
    const g = clone()
    g.summary = 'Computer science student who builds responsive web interfaces.'
    g.experience[0].bullets = ['Developed dashboard components, cutting page load time by 30%.']

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.clean).toBe(true)
  })

  it('allows surfacing a skill the original prose already demonstrated', () => {
    // Parsers routinely miss skills the text plainly shows; naming one is not
    // an invention.
    const withDashboards = clone()
    withDashboards.skills = [...SOURCE.skills, 'dashboard']
    expect(verifyNoFabrication(SOURCE, withDashboards).clean).toBe(true)
  })
})

describe('fabrication is caught', () => {
  it('catches an invented employer', () => {
    const g = clone()
    g.experience.push({
      company: 'Google', role: 'SWE Intern', start_date: '2025-01', end_date: '2025-06',
      bullets: ['Worked on Search.'],
    })

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.clean).toBe(false)
    expect(v.findings.some((f) => f.kind === 'company' && f.value === 'Google')).toBe(true)
  })

  it('catches an invented qualification', () => {
    const g = clone()
    g.education.push({
      institution: 'IIT Bombay', degree: 'M.Tech', degree_level: 'masters',
      field: 'CS', graduation_year: 2028,
    })

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.findings.some((f) => f.kind === 'institution')).toBe(true)
    expect(v.findings.some((f) => f.kind === 'degree')).toBe(true)
  })

  it('catches a stretched employment date', () => {
    const g = clone()
    g.experience[0].start_date = '2023-06' // a year earlier than reality

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.findings.some((f) => f.kind === 'date')).toBe(true)
  })

  it('catches an invented metric', () => {
    // The most common embellishment, and the one an interviewer probes first.
    const g = clone()
    g.experience[0].bullets = ['Built dashboard components serving 85,000 users.']

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.findings.some((f) => f.kind === 'metric' && f.value.includes('85'))).toBe(true)
  })

  it('keeps a metric that was genuinely in the original', () => {
    const g = clone()
    g.experience[0].bullets = ['Cut page load time by 30% across the dashboard.']
    expect(verifyNoFabrication(SOURCE, g).clean).toBe(true)
  })

  it('catches an unconfirmed new project', () => {
    const g = clone()
    g.projects.push({ name: 'Realtime Chat App', description: 'WebSocket chat', technologies: ['WebSockets'] })

    const v = verifyNoFabrication(SOURCE, g)
    expect(v.findings.some((f) => f.kind === 'section_growth')).toBe(true)
  })
})

describe('confirmed work is permitted', () => {
  it('allows a project the student confirmed building', () => {
    const g = clone()
    g.projects.push({ name: 'Docker deployment pipeline', description: 'Containerised the app', technologies: ['Docker'] })
    g.skills = [...SOURCE.skills, 'Docker']

    const v = verifyNoFabrication(SOURCE, g, { projects: ['Docker'], skills: ['Docker'] })
    expect(v.clean).toBe(true)
  })

  it('still blocks anything outside the confirmed list', () => {
    const g = clone()
    g.projects.push({ name: 'Docker deployment pipeline', description: 'x', technologies: ['Docker'] })
    g.projects.push({ name: 'Kubernetes cluster migration', description: 'x', technologies: ['Kubernetes'] })

    const v = verifyNoFabrication(SOURCE, g, { projects: ['Docker'] })
    expect(v.clean).toBe(false)
    expect(v.findings.some((f) => f.value.includes('Kubernetes'))).toBe(true)
    expect(v.findings.some((f) => f.value.includes('Docker'))).toBe(false)
  })
})

describe('extractMetrics', () => {
  it('finds the number shapes that read as claims', () => {
    const m = extractMetrics('Improved by 30% for 85,000 users, saving ₹50,000 and a 3x speedup.')
    expect(m).toContain('30%')
    expect(m).toContain('85,000')
    expect(m).toContain('3x')
  })

  it('ignores small incidental numbers', () => {
    // Team sizes and years should not be treated as performance claims.
    expect(extractMetrics('Worked in a team of 4 during 2024.')).not.toContain('4')
  })
})
