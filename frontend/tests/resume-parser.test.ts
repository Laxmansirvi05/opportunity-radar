import { describe, it, expect } from 'vitest'
import { validateParsedResume } from '@/lib/resume-parser/schema'
import { validatePDFBuffer }    from '@/lib/resume-parser/pdf-extractor'
import {
  passedFabricationGuard,
  parseAlternatives,
} from '@/lib/resume-optimizer/prompts'

describe('validateParsedResume', () => {
  it('accepts a valid parsed resume', () => {
    const valid = {
      name: 'Arjun Kumar',
      skills: ['python', 'sql'],
      experience: [],
      projects: [],
      education: [],
    }
    const result = validateParsedResume(JSON.stringify(valid))
    expect(result.success).toBe(true)
  })

  it('rejects invalid JSON', () => {
    const result = validateParsedResume('not valid json')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not valid JSON')
    }
  })

  it('rejects resume without name', () => {
    const invalid = { skills: ['python'], experience: [], projects: [], education: [] }
    const result  = validateParsedResume(JSON.stringify(invalid))
    expect(result.success).toBe(false)
  })

  it('accepts resume with optional fields omitted', () => {
    const minimal = { name: 'Test User' }
    const result  = validateParsedResume(JSON.stringify(minimal))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.skills).toEqual([])
      expect(result.data.experience).toEqual([])
    }
  })
})

describe('validatePDFBuffer', () => {
  it('rejects empty buffer', () => {
    const result = validatePDFBuffer(new ArrayBuffer(0))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('rejects buffer without PDF magic bytes', () => {
    const buffer = new ArrayBuffer(100)
    new Uint8Array(buffer).fill(0)
    const result = validatePDFBuffer(buffer)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('valid PDF')
  })

  it('accepts buffer with PDF magic bytes', () => {
    const buffer = new ArrayBuffer(100)
    const view   = new Uint8Array(buffer)
    // Write %PDF header (ASCII)
    ;[0x25, 0x50, 0x44, 0x46, 0x2D].forEach((b, i) => { view[i] = b })
    const result = validatePDFBuffer(buffer)
    expect(result.valid).toBe(true)
  })
})

describe('passedFabricationGuard', () => {
  it('allows generated bullet with no new numbers', () => {
    const original  = 'Built a web app using React and Flask'
    const generated = 'Developed a full-stack web application using React and Flask, improving developer workflow.'
    expect(passedFabricationGuard(original, generated)).toBe(true)
  })

  it('rejects generated bullet with invented number', () => {
    const original  = 'Built a web app using React and Flask'
    const generated = 'Increased performance by 40% using React and Flask optimisations.'
    expect(passedFabricationGuard(original, generated)).toBe(false)
  })

  it('allows generated bullet that includes original number', () => {
    const original  = 'Managed 5 team projects simultaneously'
    const generated = 'Coordinated 5 concurrent team projects, ensuring on-time delivery.'
    expect(passedFabricationGuard(original, generated)).toBe(true)
  })

  it('rejects very short generated bullets', () => {
    const original  = 'Built an app'
    const generated = 'Built app'  // < 8 words
    expect(passedFabricationGuard(original, generated)).toBe(false)
  })
})

describe('parseAlternatives', () => {
  it('parses 3 alternatives from numbered output', () => {
    const raw = `1. Built a scalable REST API using Node.js and Express.
2. Engineered a high-performance backend service with Node.js.
3. Developed and deployed a RESTful API with Express and Node.js.`
    const alts = parseAlternatives(raw)
    expect(alts.length).toBe(3)
    expect(alts[0]).toContain('REST API')
  })

  it('handles extra blank lines in AI output', () => {
    const raw = `

1. First alternative here.

2. Second alternative here.

3. Third alternative here.
`
    const alts = parseAlternatives(raw)
    expect(alts.length).toBe(3)
  })

  it('returns fewer than 3 if AI output is truncated', () => {
    const raw = `1. Only one alternative provided.`
    const alts = parseAlternatives(raw)
    expect(alts.length).toBe(1)
  })
})
