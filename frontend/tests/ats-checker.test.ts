import { describe, it, expect } from 'vitest'
import { calculateAtsReadiness } from '@/lib/ats-checker/readiness'
import { calculateJobMatch } from '@/lib/ats-checker/job-match'
import { normalizeSkillArray } from '@/lib/ats-checker/normalization'
import type { ParsedResume } from '@/types/resume'
import type { JDExtraction } from '@/features/resume-toolkit/lib/schema/resume/ats-check'

const baseResume: ParsedResume = {
  name: "Test User",
  email: "test@example.com",
  phone: "1234567890",
  skills: [],
  experience: [],
  projects: [],
  education: []
}

const strongResume: ParsedResume = {
  ...baseResume,
  name: 'John Doe',
  summary: 'A highly motivated Software Engineer with 2 years of experience building scalable applications using React, Node.js, and PostgreSQL in an Agile environment with strong teamwork.',
  skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Docker', 'AWS'],
  education: [
    { institution: 'University of Technology', degree: 'Computer Science', degree_level: 'bachelors', graduation_year: 2024 }
  ],
  experience: [
    {
      company: 'Tech Corp',
      role: 'Frontend Developer',
      start_date: '2022-01-01',
      end_date: '2024-01-01',
      bullets: [
        'Developed a high-performance web application using React, TypeScript, and Node.js.',
        'Increased user engagement by 20% through an optimized UI redesign deployed on AWS.',
        'Led a team of 3 developers to deliver the project 2 weeks ahead of schedule using Docker.',
        'Reduced load time by 30% by implementing lazy loading.'
      ]
    }
  ],
  projects: [
    {
      name: 'Frontend Project',
      description: 'Built a frontend application using React and TypeScript for team collaboration.',
      technologies: ['React', 'TypeScript']
    }
  ]
}

describe('normalizeSkillArray', () => {
  it('normalizes aliases correctly', () => {
    const input = ['ReactJS', 'React', 'Node.js', 'PostgreSQL', 'TS', 'JavaScript']
    const output = normalizeSkillArray(input)
    expect(output).toEqual(['javascript', 'node', 'postgres', 'react', 'typescript'])
  })
})

describe('calculateAtsReadiness', () => {
  it('gives a high score to a strong resume', () => {
    const result = calculateAtsReadiness(strongResume)
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.categories.coreSections.score).toBe(20)
    expect(result.categories.parsability.score).toBe(15)
  })

  it('deducts points for missing contact info', () => {
    const weakResume = { ...strongResume, email: undefined, phone: undefined }
    const result = calculateAtsReadiness(weakResume as ParsedResume)
    expect(result.categories.coreSections.score).toBeLessThan(20)
  })

  it('handles student without experience but with projects well', () => {
    const studentResume: ParsedResume = {
      ...strongResume,
      experience: [],
      projects: [{ name: 'Project X', technologies: ['React'], description: 'A massive project that I built using React and Node.js. It had over 500 active users.' }]
    }
    const result = calculateAtsReadiness(studentResume)
    expect(result.categories.coreSections.score).toBeGreaterThan(10)
  })

  it('deducts impact points for weak bullets', () => {
    const weakBulletsResume: ParsedResume = {
      ...strongResume,
      experience: [{
        company: 'Company',
        role: 'Role',
        start_date: '2020-01-01',
        bullets: ['did some work', 'was responsible for coding', 'helped the team', 'went to meetings']
      }]
    }
    const result = calculateAtsReadiness(weakBulletsResume)
    expect(result.categories.impact.score).toBeLessThan(10)
  })
})

describe('ATS Gaming Resistance & Edge Cases', () => {
  it('handles non-string summary objects without throwing TypeError', () => {
    const objectSummaryResume = {
      ...baseResume,
      summary: { content: 'Full stack developer with 3 years experience building cloud applications.' } as any,
    }
    expect(() => calculateAtsReadiness(objectSummaryResume as any)).not.toThrow()
    const result = calculateAtsReadiness(objectSummaryResume as any)
    expect(result.score).toBeGreaterThan(0)
  })

  it('penalizes keyword-stuffed resumes', () => {
    const keywordStuffed: ParsedResume = {
      ...baseResume,
      summary: "React React React Developer with React Node Node AWS AWS AWS AWS Docker Kubernetes Agile Scrum React Angular Vue Svelte.",
      skills: Array(45).fill("React"),
      experience: [
        {
          company: "Fake Corp",
          role: "Developer",
          start_date: "2020-01-01",
          bullets: [
            "React Node AWS Docker Kubernetes Agile Scrum React Angular Vue Svelte.",
            "React Node AWS Docker Kubernetes Agile Scrum React Angular Vue Svelte."
          ]
        }
      ],
    }
    const result = calculateAtsReadiness(keywordStuffed)
    expect(result.score).toBeLessThan(75) // Should not get "Good" score
  })

  it('penalizes metrics-gaming resumes (meaningless numbers)', () => {
    const metricsGaming: ParsedResume = {
      ...baseResume,
      summary: "I have 100% passion and 1000 ideas for 500 projects in 2024.",
      skills: ["React", "TypeScript", "Node.js", "AWS"],
      experience: [
        {
          company: "Gaming Corp",
          role: "Developer",
          start_date: "2020-01-01",
          bullets: [
            "Ate 5 apples at 12 PM with 3 friends.",
            "Walked 10000 steps on 5 days in 2023.",
            "Typed 100 words per 1 minute on 2 keyboards."
          ]
        }
      ],
    }
    const result = calculateAtsReadiness(metricsGaming)
    expect(result.score).toBeLessThan(80) // Should not get "Good" score
  })

  it('rewards strong fresher resumes with excellent projects', () => {
    const strongFresher: ParsedResume = {
      ...baseResume,
      summary: "Highly motivated Computer Science graduate with strong foundations in full-stack development. Proven ability to build production-ready applications through open-source contributions and complex academic projects.",
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "Git"],
      projects: [
        {
          name: "E-Commerce Microservices",
          description: "Built a scalable e-commerce backend using Node.js, Docker, and PostgreSQL. Implemented JWT authentication and Stripe payment integration.",
          technologies: ["Node.js", "Docker", "PostgreSQL"]
        },
        {
          name: "Real-time Chat App",
          description: "Developed a real-time messaging application using React, Socket.io, and Redis. Supported concurrent 100+ user chat rooms.",
          technologies: ["React", "Socket.io", "Redis"]
        }
      ],
      education: [{ institution: "University", degree: "B.S. CS", degree_level: "bachelors" }]
    }
    const result = calculateAtsReadiness(strongFresher)
    expect(result.score).toBeGreaterThanOrEqual(85) // Strong fresher should score well
  })
})

describe('calculateJobMatch', () => {
  const jd = {
    targetRole: 'Frontend Developer',
    roleFamily: 'Software Engineering',
    requiredSkills: ['react', 'typescript', 'tailwind'],
    preferredSkills: ['node', 'graphql'],
    keywords: ['frontend', 'ui', 'components'],
    responsibilities: ['Build UIs', 'Optimize performance'],
    minimumExperienceMonths: 24,
    educationRequirements: 'bachelors' as const,
    hardRequirements: []
  }

  const strongResume = {
    name: 'John',
    skills: ['react', 'typescript', 'tailwind', 'node'],
    experience: [{ company: 'Tech', role: 'Frontend Developer', start_date: '2020', bullets: ['Built React apps using TypeScript and Tailwind.', 'Optimized frontend performance.'] }],
    projects: [],
    education: [{ institution: 'State Univ', degree: 'BS Computer Science', degree_level: 'bachelors' as const }]
  }

  it('matches highly with aligned JD', () => {
    const result = calculateJobMatch(strongResume as ParsedResume, jd as any)
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.categories.requiredSkills.score).toBe(30) // Max requiredSkills score is 30
    expect(result.evidencedSkills).toContain('react')
    expect(result.evidencedSkills).toContain('typescript')
  })

  it('deducts for missing skills', () => {
    const weakJd = {
      ...jd,
      requiredSkills: ['python', 'django']
    }
    const result = calculateJobMatch(strongResume as ParsedResume, weakJd as any)
    expect(result.categories.requiredSkills.score).toBe(0)
    expect(result.missingRequiredSkills).toContain('python')
    expect(result.missingRequiredSkills).toContain('django')
  })

  it('penalizes keyword stuffed resume for Job Match', () => {
    const keywordStuffed = {
      name: 'Spammer',
      skills: ['react', 'typescript', 'tailwind', 'node', 'graphql', 'aws', 'docker', 'kubernetes'],
      experience: [{
        company: 'Spam Inc',
        role: 'Dev',
        start_date: '2023',
        bullets: ['Did some coding.'] // none of the skills mentioned here
      }],
      projects: [],
      education: []
    }
    const result = calculateJobMatch(keywordStuffed as ParsedResume, jd as any)
    expect(result.score).toBeLessThan(60) // Should score very poorly on Job Match because skills are listed but not evidenced
  })
})
