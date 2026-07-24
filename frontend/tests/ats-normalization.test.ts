import { describe, it, expect } from 'vitest'
import { normalizeToAtsResume } from '../lib/ats-checker/normalization'

describe('normalizeToAtsResume', () => {
  it('should extract individual skills from structured canonical ResumeData format without treating category names as skills', () => {
    const rawData = {
      basics: { name: 'John Doe' },
      sections: {
        skills: {
          items: [
            { name: 'Languages', keywords: ['JavaScript', 'TypeScript', 'Python'] },
            { name: 'Frontend', keywords: ['React.js', 'Next.js', 'Tailwind CSS'] }
          ]
        }
      }
    }
    
    const normalized = normalizeToAtsResume(rawData)
    
    // Should preserve individual skills
    expect(normalized.skills).toContain('JavaScript')
    expect(normalized.skills).toContain('TypeScript')
    expect(normalized.skills).toContain('Python')
    expect(normalized.skills).toContain('React.js')
    
    // Should NOT contain the category titles
    expect(normalized.skills).not.toContain('Languages')
    expect(normalized.skills).not.toContain('Frontend')
    
    // Should not contain [object Object]
    expect(normalized.skills.some(s => typeof s !== 'string' || s.includes('[object Object]'))).toBe(false)
  })

  it('should handle legacy string array format', () => {
    const rawData = {
      name: 'Jane Doe',
      skills: ['  Python', 'React  ']
    }
    const normalized = normalizeToAtsResume(rawData)
    expect(normalized.skills).toEqual(['Python', 'React'])
  })
})
