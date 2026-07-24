import { describe, it, expect } from 'vitest'
import { buildJDExtractionPrompt } from '../features/resume-toolkit/services/ai/ats-prompts'
import { jdExtractionSchema } from '../features/resume-toolkit/lib/schema/resume/ats-check'

describe('JD Extraction AI Prompt & Schema', () => {
  it('Prompt contains strict rules for primary source of truth', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD', 'Test Company', 'Frontend Developer')
    expect(systemPrompt).toContain('Job Description is the primary source of truth')
  })

  it('Prompt contains protections against company hallucination', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD', 'Test Company', 'Frontend Developer')
    expect(systemPrompt).toContain('Never invent requirements because of the company name')
  })

  it('Prompt enforces separation of required and preferred skills', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD')
    expect(systemPrompt).toContain('preferredSkills, NOT requiredSkills')
  })

  it('Prompt protects against extracting HR/marketing boilerplate as keywords', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD')
    expect(systemPrompt).toContain('Do NOT extract benefits, EEO text, company marketing')
  })

  it('Schema strictly validates expected JD extraction shape', () => {
    const validData = {
      targetRole: 'Frontend Intern',
      roleFamily: 'Frontend',
      requiredSkills: ['React', 'JavaScript'],
      preferredSkills: ['Next.js'],
      keywords: ['accessibility'],
      responsibilities: ['Build UI'],
      minimumExperienceMonths: null,
      educationRequirements: 'bachelors',
      hardRequirements: [{ rule: 'Must graduate in 2027', type: 'Required' }]
    }
    
    const parsed = jdExtractionSchema.safeParse(validData)
    expect(parsed.success).toBe(true)
  })
})
