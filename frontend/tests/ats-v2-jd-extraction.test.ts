import { describe, it, expect } from 'vitest'
import { structuredJDSchema, jdRequirementSchema } from '../features/resume-toolkit/lib/schema/resume/ats-v2'

describe('ATS V2 JD Extraction Schema Validation', () => {
  it('validates a correct structured JD payload', () => {
    const validJd = {
      jobTitle: 'Frontend Engineer',
      companyName: 'Acme Corp',
      roleFamily: 'Software Engineering',
      seniority: 'Senior',
      requirements: [
        {
          id: 'req_react',
          name: 'React.js',
          category: 'technical_capability',
          importance: 'high',
          description: '3+ years React',
          provenance: {
            exactQuote: '3+ years of React experience',
            context: 'Requirements section',
          },
        },
        {
          id: 'req_degree',
          name: 'B.S. in Computer Science',
          category: 'education',
          importance: 'medium',
          description: 'Degree requirement',
          provenance: {
            exactQuote: 'Bachelor degree in CS',
          },
        },
      ],
    }

    const result = structuredJDSchema.safeParse(validJd)
    expect(result.success).toBe(true)
  })

  it('rejects invalid category or importance enum values', () => {
    const invalidJd = {
      requirements: [
        {
          id: 'req_1',
          name: 'Invalid Req',
          category: 'not_a_category',
          importance: 'super_high',
          provenance: {},
        },
      ],
    }

    const result = structuredJDSchema.safeParse(invalidJd)
    expect(result.success).toBe(false)
  })
})
