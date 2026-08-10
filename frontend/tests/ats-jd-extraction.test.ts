import { describe, it, expect } from 'vitest'
import { buildJDExtractionPrompt } from '../features/resume-toolkit/services/ai/ats-v2-prompts'
import { structuredJDSchema } from '../features/resume-toolkit/lib/schema/resume/ats-v2'

describe('V2 JD Extraction AI Prompt & Schema', () => {
  it('Prompt contains strict rules for primary source of truth', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD', 'Test Company', 'Frontend Developer')
    expect(systemPrompt).toContain('Job Description is the primary and only source of truth')
  })

  it('Prompt contains protections against company hallucination', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD', 'Test Company', 'Frontend Developer')
    expect(systemPrompt).toContain('never invent a requirement because of what the company or role name implies')
  })

  it('Prompt enforces preferred_qualification for "nice to have" style phrasing', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD')
    expect(systemPrompt).toContain('preferred_qualification')
    expect(systemPrompt).toContain('nice to have')
    expect(systemPrompt).toContain('mark these as hard_requirement')
  })

  it('Prompt protects against extracting HR/marketing boilerplate as requirements', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD')
    expect(systemPrompt).toContain('Do NOT extract benefits, perks, EEO/diversity boilerplate')
  })

  it('Prompt instructs the model to extract every requirement, not stop early', () => {
    const { systemPrompt } = buildJDExtractionPrompt('Test JD')
    expect(systemPrompt).toContain('A typical real JD yields 8-20 requirements')
  })

  it('Schema strictly validates expected structured JD shape', () => {
    const validData = {
      roleTitle: 'Frontend Intern',
      companyName: 'Acme Corp',
      roleFamily: 'Frontend',
      requirements: [
        {
          id: 'req_react',
          name: 'React.js',
          category: 'technical_capability',
          importance: 'high',
          description: 'React experience required.',
          provenance: { exactQuote: 'Experience with React required.' },
        },
      ],
    }

    const parsed = structuredJDSchema.safeParse(validData)
    expect(parsed.success).toBe(true)
  })

  it('Schema rejects invalid category or importance enum values', () => {
    const invalidData = {
      requirements: [
        {
          id: 'req_1',
          name: 'React.js',
          category: 'not_a_real_category',
          importance: 'super_critical',
          provenance: {},
        },
      ],
    }
    const parsed = structuredJDSchema.safeParse(invalidData)
    expect(parsed.success).toBe(false)
  })
})
