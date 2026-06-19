import { describe, it, expect } from 'vitest'
import {
  normaliseSkill,
  normaliseSkillArray,
  computeSkillScore,
  computeProjectScore,
  computeExperienceScore,
  computeEducationScore,
  computeATSScore,
  computeImprovementScore,
  deriveStudentLevel,
  rankMissingSkills,
} from '@/lib/ats-engine/scoring'

describe('normaliseSkill', () => {
  it('lowercases and trims', () => {
    expect(normaliseSkill('  Python  ')).toBe('python')
    expect(normaliseSkill('ReactJS')).toBe('reactjs')
  })

  it('preserves tech-special chars', () => {
    expect(normaliseSkill('C++')).toBe('c++')
    expect(normaliseSkill('Node.js')).toBe('node.js')
    expect(normaliseSkill('scikit-learn')).toBe('scikit-learn')
  })
})

describe('computeSkillScore', () => {
  it('returns 0.5 when no opportunity skills defined', () => {
    const { score } = computeSkillScore(['python', 'sql'], [])
    expect(score).toBe(0.5)
  })

  it('calculates correct intersection ratio', () => {
    const { score, matched } = computeSkillScore(
      ['python', 'sql', 'react'],
      ['python', 'sql', 'pandas', 'scikit-learn']
    )
    expect(score).toBeCloseTo(0.5)
    expect(matched).toEqual(expect.arrayContaining(['python', 'sql']))
    expect(matched.length).toBe(2)
  })

  it('caps score at 1.0', () => {
    const { score } = computeSkillScore(
      ['python', 'sql', 'react', 'docker', 'aws'],
      ['python', 'sql']
    )
    expect(score).toBe(1.0)
  })

  it('returns 0 when student has no matching skills', () => {
    const { score, matched } = computeSkillScore(['java', 'spring'], ['python', 'ml'])
    expect(score).toBe(0)
    expect(matched.length).toBe(0)
  })
})

describe('computeProjectScore', () => {
  it('excludes already matched skills to avoid double-counting', () => {
    const { score, matched } = computeProjectScore(
      ['pandas', 'matplotlib'],   // project keywords
      ['python', 'sql', 'pandas'], // opp skills
      ['python']                  // already matched in skills
    )
    // pandas is NOT in already matched, so it qualifies
    expect(matched).toContain('pandas')
    expect(score).toBeCloseTo(1 / 3)
  })

  it('returns 0.5 when no opportunity skills defined', () => {
    const { score } = computeProjectScore(['pandas'], [], [])
    expect(score).toBe(0.5)
  })
})

describe('computeExperienceScore', () => {
  it('returns 1.0 for any/null requirement', () => {
    expect(computeExperienceScore('Fresher', null)).toBe(1.0)
    expect(computeExperienceScore('Fresher', 'Any')).toBe(1.0)
  })

  it('returns 1.0 for exact level match', () => {
    expect(computeExperienceScore('Junior', 'Junior')).toBe(1.0)
  })

  it('penalises under-qualification', () => {
    expect(computeExperienceScore('Fresher', 'Senior')).toBe(0.2)
  })

  it('gives slight penalty for over-qualification', () => {
    const score = computeExperienceScore('Senior', 'Fresher')
    expect(score).toBe(0.8)
  })
})

describe('deriveStudentLevel', () => {
  it('returns Fresher for 0 months', () => {
    expect(deriveStudentLevel(0)).toBe('Fresher')
  })

  it('returns Junior for 12 months', () => {
    expect(deriveStudentLevel(12)).toBe('Junior')
  })

  it('returns Senior for 72 months', () => {
    expect(deriveStudentLevel(72)).toBe('Senior')
  })
})

describe('computeATSScore', () => {
  it('returns correct weighted score', () => {
    const score = computeATSScore({
      skill_score:      0.4,
      project_score:    0.2,
      experience_score: 1.0,
      education_score:  1.0,
    })
    // 0.4*0.55 + 0.2*0.15 + 1.0*0.20 + 1.0*0.10 = 0.55 → 55
    expect(score).toBe(55)
  })

  it('returns 100 for perfect match', () => {
    const score = computeATSScore({
      skill_score:      1.0,
      project_score:    1.0,
      experience_score: 1.0,
      education_score:  1.0,
    })
    expect(score).toBe(100)
  })

  it('returns 0 for no match at all', () => {
    const score = computeATSScore({
      skill_score:      0,
      project_score:    0,
      experience_score: 0,
      education_score:  0,
    })
    expect(score).toBe(0)
  })
})

describe('computeImprovementScore', () => {
  it('is always >= ats_score', () => {
    const ats = computeATSScore({
      skill_score: 0.4, project_score: 0.2,
      experience_score: 1.0, education_score: 1.0
    })
    const imp = computeImprovementScore({
      project_score: 0.2, experience_score: 1.0, education_score: 1.0
    })
    expect(imp).toBeGreaterThanOrEqual(ats)
  })

  it('equals ats_score when skill is already perfect', () => {
    const ats = computeATSScore({
      skill_score: 1.0, project_score: 1.0,
      experience_score: 1.0, education_score: 1.0
    })
    const imp = computeImprovementScore({
      project_score: 1.0, experience_score: 1.0, education_score: 1.0
    })
    expect(ats).toBe(imp)
  })
})

describe('rankMissingSkills', () => {
  it('ranks HIGH when skill is in title', () => {
    const freqMap = new Map([['python', 100], ['docker', 10]])
    const ranked  = rankMissingSkills(['python', 'docker'], 'Python Data Analyst', freqMap)
    const python  = ranked.find((r) => r.skill === 'python')
    expect(python?.importance).toBe('HIGH')
  })

  it('sorts HIGH before MEDIUM before LOW', () => {
    const freqMap = new Map([['ml', 200], ['react', 50], ['figma', 5]])
    const ranked  = rankMissingSkills(['ml', 'react', 'figma'], 'ML Engineer', freqMap)
    const importances = ranked.map((r: { skill: string; importance: string }) => r.importance)
    const highIdx  = importances.indexOf('HIGH')
    const medIdx   = importances.indexOf('MEDIUM')
    const lowIdx   = importances.indexOf('LOW')
    if (highIdx !== -1 && medIdx !== -1) expect(highIdx).toBeLessThan(medIdx)
    if (medIdx  !== -1 && lowIdx  !== -1) expect(medIdx).toBeLessThan(lowIdx)
  })
})
