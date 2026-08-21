import { describe, it, expect } from 'vitest'
import { calculateAtsV2Score, calculateQualityScore } from '../lib/ats-checker/scoring-v2'
import type { StructuredJD, EvidenceMatrix } from '../features/resume-toolkit/lib/schema/resume/ats-v2'
import type { ParsedResume } from '../types/resume'

const mockResume: ParsedResume = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '123-456-7890',
  summary: 'Experienced Software Engineer specializing in React, Node.js, and Cloud Infrastructure.',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  experience: [
    {
      company: 'Tech Corp',
      role: 'Senior Frontend Engineer',
      start_date: '2021-01',
      end_date: '2023-12',
      bullets: [
        'Built scalable UI components in React and TypeScript reducing load time by 40%.',
        'Managed state using Redux and optimized render cycles.',
      ],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'B.S.',
      degree_level: 'bachelors',
      field: 'Computer Science',
      graduation_year: 2020,
    },
  ],
  projects: [
    {
      name: 'E-commerce Platform',
      description: 'Built full-stack store with Next.js and TailwindCSS.',
      technologies: ['Next.js', 'TailwindCSS', 'Stripe'],
    },
  ],
}

const mockStructuredJd: StructuredJD = {
  jobTitle: 'Senior Frontend Engineer',
  companyName: 'Tech Corp',
  roleFamily: 'Software Engineering',
  seniority: 'Senior',
  requirements: [
    {
      id: 'req_react',
      name: 'React.js',
      category: 'technical_capability',
      importance: 'critical',
      description: 'Strong React experience',
      provenance: { exactQuote: 'React' },
    },
    {
      id: 'req_ts',
      name: 'TypeScript',
      category: 'technical_capability',
      importance: 'high',
      description: 'TypeScript proficiency',
      provenance: { exactQuote: 'TypeScript' },
    },
    {
      id: 'req_missing',
      name: 'GraphQL',
      category: 'technical_capability',
      importance: 'medium',
      description: 'GraphQL API experience',
      provenance: { exactQuote: 'GraphQL' },
    },
  ],
}

const mockEvidenceMatrix: EvidenceMatrix = {
  evaluations: [
    {
      capabilityId: 'req_react',
      satisfaction: 'complete',
      evidenceStrength: 'exceptional',
      evidenceReferences: [
        {
          evidenceId: 'exp_1',
          sourceSection: 'experience',
          exactText: 'Built scalable UI components in React and TypeScript reducing load time by 40%.',
          evidenceType: 'professional_experience',
          technologiesDemonstrated: ['React', 'TypeScript'],
          quantifiedImpact: 'reducing load time by 40%',
          confidence: 0.95,
        },
      ],
      confidence: 0.95,
      semanticReasoning: 'Direct evidence in experience section with quantified impact.',
    },
    {
      capabilityId: 'req_ts',
      satisfaction: 'substantial',
      evidenceStrength: 'strong',
      evidenceReferences: [
        {
          evidenceId: 'skill_2',
          sourceSection: 'skills',
          exactText: 'TypeScript',
          evidenceType: 'listed_skill',
          technologiesDemonstrated: ['TypeScript'],
          confidence: 0.8,
        },
      ],
      confidence: 0.85,
      semanticReasoning: 'Listed skill and experience context.',
    },
  ],
}

describe('ATS V2 Deterministic Scoring Engine', () => {
  it('calculates deterministic score consistently for same inputs', () => {
    const score1 = calculateAtsV2Score(mockStructuredJd, mockEvidenceMatrix, mockResume)
    const score2 = calculateAtsV2Score(mockStructuredJd, mockEvidenceMatrix, mockResume)

    expect(score1.overallScore).toBe(score2.overallScore)
    expect(score1.capabilityScore).toBe(score2.capabilityScore)
    expect(score1.qualityScore).toBe(score2.qualityScore)
    expect(score1.band).toBe(score2.band)
  })

  it('correctly attributes scores to matched vs missing requirements', () => {
    const score = calculateAtsV2Score(mockStructuredJd, mockEvidenceMatrix, mockResume)

    const reactReq = score.requirements.find((r) => r.requirementId === 'req_react')
    expect(reactReq?.satisfaction).toBe('complete')
    expect(reactReq?.hasQuantifiedImpact).toBe(true)

    const missingReq = score.requirements.find((r) => r.requirementId === 'req_missing')
    expect(missingReq?.satisfaction).toBe('none')
    expect(missingReq?.weightedScore).toBe(0)
  })

  it('calculates resume quality score accurately', () => {
    const quality = calculateQualityScore(mockResume)
    expect(quality.hasContactInfo).toBe(true)
    expect(quality.hasExperience).toBe(true)
    expect(quality.hasEducation).toBe(true)
    expect(quality.hasSkills).toBe(true)
    expect(quality.hasProjects).toBe(true)
    expect(quality.hasQuantifiedBullets).toBe(true)
    expect(quality.total).toBe(100)
  })

  it('assigns correct score bands based on overall score', () => {
    const score = calculateAtsV2Score(mockStructuredJd, mockEvidenceMatrix, mockResume)
    expect(['exceptional', 'strong', 'moderate', 'partial', 'weak', 'poor']).toContain(score.band)
  })
})

/**
 * The evidence evaluator can return fewer evaluations than there are
 * requirements — most often because its output was truncated. Observed live:
 * a 32-requirement backend JD came back with 14 evaluations, and every
 * requirement the model never reached was scored as a hard zero *inside the
 * denominator*. The resume was marked down for our truncation, and the
 * untouched requirements were then listed to the student as Critical Gaps.
 */
describe('calculateAtsV2Score — requirements the evaluator never returned', () => {
  const twoRequirements: StructuredJD = {
    roleTitle: 'Backend Engineer',
    requirements: [
      { id: 'req_react', name: 'React', category: 'technical_capability', importance: 'critical', provenance: { exactQuote: 'React', context: null } },
      { id: 'req_redis', name: 'Redis', category: 'technical_capability', importance: 'critical', provenance: { exactQuote: 'Redis', context: null } },
    ],
  } as StructuredJD

  /** Only the first requirement comes back, and it is fully satisfied. */
  const halfEvaluated: EvidenceMatrix = {
    evaluations: [
      {
        capabilityId: 'req_react',
        satisfaction: 'complete',
        evidenceStrength: 'strong',
        evidenceReferences: [
          {
            evidenceId: 'e1',
            sourceSection: 'experience',
            exactText: 'Built scalable UI components in React',
            evidenceType: 'professional_experience',
            quantifiedImpact: null,
            recency: null,
            confidence: 0.9,
          },
        ],
        confidence: 0.9,
        semanticReasoning: 'Demonstrated in professional experience.',
      },
    ],
  } as EvidenceMatrix

  it('does not let an unevaluated requirement drag the capability score down', () => {
    const result = calculateAtsV2Score(twoRequirements, halfEvaluated, mockResume)
    // One of two requirements was assessed, and it was fully met. Scoring the
    // unassessed one as a zero would roughly halve this.
    expect(result.capabilityScore).toBeGreaterThan(80)
  })

  it('marks the unevaluated requirement so it is not shown as a gap', () => {
    const result = calculateAtsV2Score(twoRequirements, halfEvaluated, mockResume)
    const redis = result.requirements.find((r) => r.requirementId === 'req_redis')
    expect(redis?.evaluated).toBe(false)
    // A gap reason would be a claim about the resume that was never checked.
    expect(redis?.gapReason).toBeNull()

    const react = result.requirements.find((r) => r.requirementId === 'req_react')
    expect(react?.evaluated).toBe(true)
  })

  it('still reports the shortfall as reduced coverage', () => {
    const result = calculateAtsV2Score(twoRequirements, halfEvaluated, mockResume)
    expect(result.confidence.evaluationCoverage).toBe(0.5)
    expect(result.confidence.unevaluatedRequirements).toContain('req_redis')
  })
})
