import { describe, it, expect } from 'vitest'
import { isHollowResume } from '@/features/resume-toolkit/lib/hollow-resume'

const empty = { items: [] }

describe('isHollowResume', () => {
  it('flags the production failure: basics filled, every section empty', () => {
    expect(
      isHollowResume({
        basics: { name: 'Asha Rao', email: 'asha@example.com' },
        sections: { experience: empty, education: empty, skills: empty, projects: empty },
      })
    ).toBe(true)
  })

  it('flags a document with no sections at all', () => {
    expect(isHollowResume({ basics: { name: 'x' } })).toBe(true)
    expect(isHollowResume(null)).toBe(true)
  })

  it.each(['experience', 'education', 'skills', 'projects'])('accepts a résumé with only %s', (name) => {
    const sections = { experience: empty, education: empty, skills: empty, projects: empty, [name]: { items: [{}] } }
    expect(isHollowResume({ sections })).toBe(false)
  })
})
