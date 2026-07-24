import { describe, it, expect } from 'vitest'
import { calculateJobMatch } from '../lib/ats-checker/job-match'

describe('Targeted Job Match V2 - Audit', () => {
  const baseJD = {
    targetRole: 'Frontend Developer',
    roleFamily: 'Frontend',
    requiredSkills: ['React', 'TypeScript', 'Node.js'],
    preferredSkills: ['Tailwind'],
    keywords: ['ui/ux'],
    responsibilities: [],
    minimumExperienceMonths: 24,
    educationRequirements: 'bachelors',
    hardRequirements: []
  }

  it('1. Skill alias evidence - Equivalent forms receive same credit', () => {
    const resumeReactJS = { skills: [], projects: [{ name: 'A', description: 'Built with ReactJS.' }] }
    const resReact = calculateJobMatch(resumeReactJS as any, baseJD as any)
    
    const resumeReactDotJs = { skills: [], projects: [{ name: 'A', description: 'Built with React.js.' }] }
    const resReactDotJs = calculateJobMatch(resumeReactDotJs as any, baseJD as any)

    expect(resReact.categories.requiredSkills.score).toBeGreaterThan(0)
    expect(resReact.categories.requiredSkills.score).toBe(resReactDotJs.categories.requiredSkills.score)
  })

  it('1. Skill alias evidence - NO false equivalence', () => {
    // Java vs JavaScript
    const javaResume = { skills: [], projects: [{ name: 'A', description: 'Built with Java.' }] }
    const javaJD = { ...baseJD, requiredSkills: ['JavaScript'] }
    const resJava = calculateJobMatch(javaResume as any, javaJD as any)
    expect(resJava.categories.requiredSkills.score).toBe(0) // Java should not match JavaScript

    // React vs Angular
    const angularResume = { skills: [], projects: [{ name: 'A', description: 'Built with Angular.' }] }
    const angularJD = { ...baseJD, requiredSkills: ['React'] }
    const resAngular = calculateJobMatch(angularResume as any, angularJD as any)
    expect(resAngular.categories.requiredSkills.score).toBe(0)
  })

  it('2. Experience scoring - Irrelevant experience does not count', () => {
    const graphicDesignerResume = {
      experience: [
        {
          company: 'Design Co',
          role: 'Graphic Designer',
          start_date: '2020-01-01',
          end_date: '2023-01-01', // 3 years
          bullets: ['Designed logos', 'Used Photoshop']
        }
      ]
    }
    const res = calculateJobMatch(graphicDesignerResume as any, baseJD as any)
    // Needs 24 months of frontend/react/typescript, has 3 years of graphic design.
    expect(res.categories.experienceRelevance.score).toBeLessThan(15) // Shouldn't be 15
  })

  it('3. Project scoring - Unrelated projects do not get baseline points', () => {
    const unrelatedProjectsResume = {
      projects: [
        {
          name: 'Painting Collection',
          description: 'A collection of watercolor paintings.'
        }
      ]
    }
    const res = calculateJobMatch(unrelatedProjectsResume as any, baseJD as any)
    expect(res.categories.projectEvidence.score).toBe(0) // Shouldn't be 5 simply because projects exist
  })

  it('4. Hard requirements - Safely falls back to UNKNOWN', () => {
    const reqJD = {
      ...baseJD,
      hardRequirements: [
        { rule: 'Must graduate in 2027' },
        { rule: 'Must have active Top Secret clearance' }
      ]
    }
    const noEvidenceResume = {
      education: [{ degree: 'BSCS', end_date: '2027-05-01' }], // The year 2027 is present, but clearance is not
    }
    
    const res = calculateJobMatch(noEvidenceResume as any, reqJD as any)
    const hr = res.hardRequirements || []
    
    const grad = hr.find(r => r.rule.includes('graduate'))
    const clearance = hr.find(r => r.rule.includes('clearance'))

    expect(grad?.status).toBe('Unknown') // Can't be sure 2027 means graduation year deterministically without AI
    expect(clearance?.status).toBe('Not Met') // No trace of clearance terms
  })

  it('5. Score integrity - Sum matches final score', () => {
    const goodResume = {
      experience: [{ company: 'Tech', role: 'Frontend Developer', start_date: '2020-01-01', end_date: '2023-01-01', bullets: ['React', 'TypeScript'] }],
      projects: [{ name: 'A', description: 'React and Node.js' }],
      skills: ['React', 'TypeScript', 'Node.js', 'Tailwind'],
      education: [{ degree: 'BSCS', degree_level: 'bachelors' }]
    }
    const res = calculateJobMatch(goodResume as any, baseJD as any)
    
    let sum = 0
    Object.values(res.categories).forEach(c => sum += c.score)
    
    expect(res.score).toBe(sum)
    expect(res.score).toBeGreaterThanOrEqual(0)
    expect(res.score).toBeLessThanOrEqual(100)
  })
})
