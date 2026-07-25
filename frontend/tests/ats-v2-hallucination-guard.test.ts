import { describe, it, expect } from 'vitest'
import { verifyEvidence, sanitizeEvidenceMatrix } from '../features/resume-toolkit/services/ai/ats-v2-hallucination-guard'
import type { ParsedResume } from '../types/resume'
import type { EvidenceReference, EvidenceMatrix } from '../features/resume-toolkit/lib/schema/resume/ats-v2'

const mockResume: ParsedResume = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  summary: 'Experienced Full Stack Engineer with expertise in React and Node.js.',
  skills: ['React', 'Node.js', 'PostgreSQL'],
  experience: [
    {
      company: 'Acme Corp',
      role: 'Software Engineer',
      start_date: '2021-01',
      bullets: ['Designed REST APIs using Node.js and Express.', 'Improved application performance by 30%.'],
    },
  ],
  projects: [],
  education: [],
}

describe('ATS V2 Hallucination Guard', () => {
  it('approves evidence grounded in resume text', () => {
    const validRef: EvidenceReference = {
      evidenceId: 'exp_1',
      sourceSection: 'experience',
      exactText: 'Designed REST APIs using Node.js and Express.',
      evidenceType: 'professional_experience',
      confidence: 0.95,
    }

    const result = verifyEvidence(mockResume, validRef)
    expect(result.isValid).toBe(true)
  })

  it('rejects fabricated evidence not found in resume', () => {
    const fabricatedRef: EvidenceReference = {
      evidenceId: 'exp_2',
      sourceSection: 'experience',
      exactText: 'Built quantum computing algorithms using Rust and C++.',
      evidenceType: 'professional_experience',
      confidence: 0.9,
    }

    const result = verifyEvidence(mockResume, fabricatedRef)
    expect(result.isValid).toBe(false)
    expect(result.reason).toContain('was not found in the resume')
  })

  it('sanitizes evidence matrix by removing invalid references', () => {
    const matrix: EvidenceMatrix = {
      evaluations: [
        {
          capabilityId: 'req_api',
          satisfaction: 'complete',
          evidenceStrength: 'strong',
          evidenceReferences: [
            {
              evidenceId: 'ref_1',
              sourceSection: 'experience',
              exactText: 'Designed REST APIs using Node.js and Express.',
              evidenceType: 'professional_experience',
              confidence: 0.95,
            },
            {
              evidenceId: 'ref_2',
              sourceSection: 'experience',
              exactText: 'Built quantum algorithms in Rust.',
              evidenceType: 'professional_experience',
              confidence: 0.9,
            },
          ],
          confidence: 0.9,
          semanticReasoning: 'Test reasoning',
        },
      ],
    }

    const { sanitizedMatrix, rejectedCount } = sanitizeEvidenceMatrix(mockResume, matrix)
    expect(rejectedCount).toBe(1)
    expect(sanitizedMatrix.evaluations[0].evidenceReferences).toHaveLength(1)
    expect(sanitizedMatrix.evaluations[0].evidenceReferences[0].evidenceId).toBe('ref_1')
  })
})
