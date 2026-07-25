import { describe, it, expect } from 'vitest'
import { extractEvidenceUnits } from '../features/resume-toolkit/services/ai/evidence-units'
import { filterCandidateEvidence } from '../features/resume-toolkit/services/ai/semantic-retrieval'
import type { ParsedResume } from '../types/resume'
import type { JDRequirement } from '../features/resume-toolkit/lib/schema/resume/ats-v2'

const mockResume: ParsedResume = {
  name: 'Alice Software Engineer',
  email: 'alice@example.com',
  summary: 'Passionate developer with experience in React and Python.',
  skills: ['React', 'Python', 'Docker'],
  experience: [
    {
      company: 'Tech Corp',
      role: 'Frontend Lead',
      startDate: '2022-01',
      highlights: [
        'Spearheaded React migration improving metrics by 25%.',
        'Built micro-frontends and REST endpoints.',
      ],
    },
  ],
  education: [
    {
      institution: 'Tech University',
      degree: 'B.S.',
      field: 'Software Engineering',
    },
  ],
}

describe('ATS V2 Evidence Unit Extraction & Retrieval', () => {
  it('extracts evidence units from all resume sections', () => {
    const units = extractEvidenceUnits(mockResume)
    expect(units.length).toBeGreaterThan(0)

    const expUnits = units.filter((u) => u.sourceSection === 'experience')
    expect(expUnits.length).toBe(2)

    const skillUnits = units.filter((u) => u.sourceSection === 'skills')
    expect(skillUnits.length).toBe(3)
  })

  it('filters candidate evidence relevant to a requirement', () => {
    const units = extractEvidenceUnits(mockResume)
    const req: JDRequirement = {
      id: 'req_react',
      name: 'React',
      category: 'technical_capability',
      importance: 'high',
      provenance: { exactQuote: 'React' },
    }

    const filtered = filterCandidateEvidence(req, units)
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.some((f) => f.exactText.includes('React'))).toBe(true)
  })
})
