import { describe, it, expect } from 'vitest'
import { computeAcademicRecommendation } from '@/lib/ats-checker/academic-recommendation'
import type { ParsedResume } from '@/types/resume'

const currentYear = new Date().getFullYear()

describe('computeAcademicRecommendation', () => {
  it('recommends improvement, warmly, for an in-progress B.Tech below the CGPA threshold', () => {
    const result = computeAcademicRecommendation([
      { institution: 'X', degree: 'B.Tech', degree_level: 'bachelors', graduation_year: currentYear + 1, gpa: 6.8 },
    ] as ParsedResume['education'])

    expect(result?.visible).toBe(true)
    expect(result?.message).toContain('6.8')
    expect(result?.message).toMatch(/upcoming exams/i)
    expect(result?.message).toMatch(/best of luck/i)
  })

  it('returns null for a degree already at or above the threshold', () => {
    const result = computeAcademicRecommendation([
      { institution: 'X', degree: 'B.Tech', degree_level: 'bachelors', graduation_year: currentYear + 1, gpa: 8.5 },
    ] as ParsedResume['education'])
    expect(result).toBeNull()
  })

  it('does not flag a completed (already graduated) degree', () => {
    const result = computeAcademicRecommendation([
      { institution: 'X', degree: 'B.Tech', degree_level: 'bachelors', graduation_year: currentYear - 1, gpa: 6.5 },
    ] as ParsedResume['education'])
    expect(result).toBeNull()
  })

  it('does not flag a non-engineering degree', () => {
    const result = computeAcademicRecommendation([
      { institution: 'X', degree: 'BA', degree_level: 'bachelors', graduation_year: currentYear + 1, gpa: 6.5 },
    ] as ParsedResume['education'])
    expect(result).toBeNull()
  })

  it('returns null when no education or no GPA is present', () => {
    expect(computeAcademicRecommendation(undefined)).toBeNull()
    expect(computeAcademicRecommendation([])).toBeNull()
    expect(computeAcademicRecommendation([
      { institution: 'X', degree: 'B.Tech', degree_level: 'bachelors', graduation_year: currentYear + 1 },
    ] as ParsedResume['education'])).toBeNull()
  })
})
