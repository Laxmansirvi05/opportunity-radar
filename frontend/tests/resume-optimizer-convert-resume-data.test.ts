import { describe, it, expect } from 'vitest'
import { convertResumeDataToParsedResume, looksLikeParsedResume } from '@/lib/resume-optimizer/convert-resume-data'

/**
 * resumes.parsed_data is stored in the Resume Builder's shape (basics /
 * sections.*.items[], HTML descriptions) -- both /api/resume/optimization
 * and the pre-existing /api/resume/ats-check used to cast it straight to
 * the flat ParsedResume shape with zero conversion, so the AI was scoring
 * against an object with name/skills/experience all undefined. This is the
 * conversion that was missing.
 */

const builderResume = {
  basics: {
    name: 'Aarav Sharma',
    email: 'aarav.sharma.dev@example.com',
    phone: '+91 98765 43210',
    website: { url: 'https://aaravdev.vercel.app' },
  },
  summary: {
    content: '<p>Final-year Computer Science student with practical experience in <strong>React</strong>.</p>',
  },
  sections: {
    profiles: {
      items: [
        { network: 'GitHub', website: { url: 'https://github.com/aaravsharma' } },
        { network: 'LinkedIn', website: { url: 'https://linkedin.com/in/aaravsharma' } },
      ],
    },
    skills: {
      items: [
        { name: 'React', keywords: ['Hooks', 'Context'] },
        { name: 'TypeScript', keywords: [] },
      ],
    },
    experience: {
      items: [
        {
          company: 'TechNova Solutions',
          position: 'Frontend Developer Intern',
          location: 'Hyderabad',
          period: 'May 2026 - Aug 2026',
          description: '<ul><li>Developed 18+ reusable React components.</li><li>Improved Lighthouse Performance from 71 to 96.</li></ul>',
          roles: [],
        },
      ],
    },
    projects: {
      items: [
        {
          name: 'Opportunity Radar',
          description: '<p>AI-powered platform aggregating internships, jobs and scholarships. Built with Next.js and PostgreSQL.</p>',
        },
      ],
    },
    education: {
      items: [
        {
          school: 'XYZ Institute of Technology',
          degree: 'B.Tech',
          area: 'Computer Science & Engineering',
          grade: '9.28/10',
          period: '2023-2027',
        },
      ],
    },
  },
}

describe('looksLikeParsedResume', () => {
  it('recognises an already-flat ParsedResume', () => {
    expect(looksLikeParsedResume({ name: 'Jane', skills: [] })).toBe(true)
  })

  it('rejects the builder shape', () => {
    expect(looksLikeParsedResume(builderResume)).toBe(false)
  })
})

describe('convertResumeDataToParsedResume', () => {
  it('pulls basics correctly', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.name).toBe('Aarav Sharma')
    expect(result.email).toBe('aarav.sharma.dev@example.com')
    expect(result.phone).toBe('+91 98765 43210')
  })

  it('finds GitHub and LinkedIn from the profiles section by network name, not position', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.github).toBe('https://github.com/aaravsharma')
    expect(result.linkedin).toBe('https://linkedin.com/in/aaravsharma')
  })

  it('strips HTML from the summary while keeping the text', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.summary).toContain('Final-year Computer Science student')
    expect(result.summary).not.toContain('<p>')
    expect(result.summary).not.toContain('<strong>')
  })

  it('flattens skill names and their keywords into one list, deduplicated', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Hooks', 'Context']))
  })

  it('converts experience: splits the period, and turns each <li> into a separate bullet', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.experience).toHaveLength(1)
    const exp = result.experience[0]
    expect(exp.company).toBe('TechNova Solutions')
    expect(exp.role).toBe('Frontend Developer Intern')
    expect(exp.start_date).toBe('May 2026')
    expect(exp.end_date).toBe('Aug 2026')
    expect(exp.bullets).toEqual([
      'Developed 18+ reusable React components.',
      'Improved Lighthouse Performance from 71 to 96.',
    ])
  })

  it('converts projects, stripping HTML from the description', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('Opportunity Radar')
    expect(result.projects[0].description).toContain('Next.js and PostgreSQL')
    expect(result.projects[0].description).not.toContain('<p>')
  })

  it('converts education: classifies degree level and parses a real 0-10 GPA', () => {
    const result = convertResumeDataToParsedResume(builderResume)
    expect(result.education).toHaveLength(1)
    const edu = result.education[0]
    expect(edu.institution).toBe('XYZ Institute of Technology')
    expect(edu.degree_level).toBe('bachelors')
    expect(edu.field).toBe('Computer Science & Engineering')
    expect(edu.gpa).toBe(9.28)
    expect(edu.graduation_year).toBe(2027)
  })

  it('does not fabricate a GPA out of a percentage — that is not the same scale', () => {
    const result = convertResumeDataToParsedResume({
      basics: { name: 'X' },
      sections: { education: { items: [{ school: 'Y', degree: 'B.Tech', grade: '94.2%' }] } },
    })
    expect(result.education[0].gpa).toBeUndefined()
  })

  it('classifies masters and diploma degrees correctly', () => {
    const masters = convertResumeDataToParsedResume({
      basics: { name: 'X' },
      sections: { education: { items: [{ school: 'Y', degree: 'M.Tech' }] } },
    })
    expect(masters.education[0].degree_level).toBe('masters')

    const diploma = convertResumeDataToParsedResume({
      basics: { name: 'X' },
      sections: { education: { items: [{ school: 'Y', degree: 'Diploma in Engineering' }] } },
    })
    expect(diploma.education[0].degree_level).toBe('diploma')
  })

  it('degrades gracefully on a mostly-empty input instead of throwing', () => {
    const result = convertResumeDataToParsedResume({})
    expect(result.name).toBe('Unknown Candidate')
    expect(result.skills).toEqual([])
    expect(result.experience).toEqual([])
    expect(result.projects).toEqual([])
    expect(result.education).toEqual([])
  })
})
