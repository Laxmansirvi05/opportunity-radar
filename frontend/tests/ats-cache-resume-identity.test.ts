import { describe, it, expect } from 'vitest'
import { isSameResume, resumeFingerprint } from '@/lib/resume-optimizer/shared-evaluation'

const backend = { name: 'Asha', skills: ['Python', 'PostgreSQL'], experience: [{ company: 'Razorpay', role: 'Intern' }] }
const marketing = { name: 'Meera', skills: ['Canva'], experience: [{ company: 'Fest', role: 'Volunteer' }] }

describe('resumeFingerprint', () => {
  it('is the same for the same content regardless of key order or padding', () => {
    const reordered = { experience: [{ role: 'Intern', company: 'Razorpay' }], skills: ['Python', 'PostgreSQL'], name: ' Asha ' }
    expect(resumeFingerprint(reordered)).toBe(resumeFingerprint(backend))
  })

  it('differs for different resumes', () => {
    expect(resumeFingerprint(backend)).not.toBe(resumeFingerprint(marketing))
  })

  it('is null when there is nothing to fingerprint', () => {
    expect(resumeFingerprint(null)).toBeNull()
    expect(resumeFingerprint(undefined)).toBeNull()
    expect(resumeFingerprint('text')).toBeNull()
  })
})

describe('isSameResume', () => {
  const fpBackend = resumeFingerprint(backend)
  const fpMarketing = resumeFingerprint(marketing)

  it('never reuses one uploaded resume\'s evaluation for a different upload', () => {
    // The live bug: both runs have resumeId null, so null === null matched.
    expect(isSameResume({ resumeId: null, resumeFingerprint: fpMarketing }, null, fpBackend)).toBe(false)
  })

  it('reuses an upload\'s evaluation for the identical upload', () => {
    expect(isSameResume({ resumeId: null, resumeFingerprint: fpBackend }, null, fpBackend)).toBe(true)
  })

  it('does not reuse an id-less row that kept no snapshot', () => {
    expect(isSameResume({ resumeId: null, resumeFingerprint: null }, null, fpBackend)).toBe(false)
    expect(isSameResume({ resumeId: null, resumeFingerprint: null }, null, null)).toBe(false)
  })

  it('matches saved resumes by id only', () => {
    expect(isSameResume({ resumeId: 'a', resumeFingerprint: null }, 'a', fpBackend)).toBe(true)
    expect(isSameResume({ resumeId: 'b', resumeFingerprint: fpBackend }, 'a', fpBackend)).toBe(false)
  })

  it('does not match a saved resume against an upload, or the reverse', () => {
    expect(isSameResume({ resumeId: 'a', resumeFingerprint: fpBackend }, null, fpBackend)).toBe(false)
    expect(isSameResume({ resumeId: null, resumeFingerprint: fpBackend }, 'a', fpBackend)).toBe(false)
  })
})
