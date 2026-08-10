import { describe, it, expect, vi, beforeEach } from 'vitest'

const extractJDIntelligence = vi.fn()
const evaluateResumeEvidence = vi.fn()
vi.mock('@/features/resume-toolkit/services/ai/ats-v2-intelligence', () => ({
  extractJDIntelligence: (...args: unknown[]) => extractJDIntelligence(...args),
  evaluateResumeEvidence: (...args: unknown[]) => evaluateResumeEvidence(...args),
}))

const generatePolishedResume = vi.fn()
const generateTargetResume = vi.fn()
vi.mock('@/lib/resume-optimizer/generate', () => ({
  generatePolishedResume: (...args: unknown[]) => generatePolishedResume(...args),
  generateTargetResume: (...args: unknown[]) => generateTargetResume(...args),
}))

// The real scoring engine is a deterministic pure function tested on its own;
// mocked here so tier-boundary behaviour can be asserted without depending on
// exactly what score a hand-built fixture resume happens to produce.
const calculateAtsV2Score = vi.fn()
vi.mock('@/lib/ats-checker/scoring-v2', () => ({
  calculateAtsV2Score: (...args: unknown[]) => calculateAtsV2Score(...args),
}))

import { startOptimizationRun, runTargetGeneration } from '@/lib/resume-optimizer/run'
import type { ParsedResume } from '@/types/resume'
import type { StructuredJD, EvidenceMatrix } from '@/features/resume-toolkit/lib/schema/resume/ats-v2'
import type { Suggestion } from '@/lib/resume-optimizer/tiers'

const resume: ParsedResume = {
  name: 'Jane Doe',
  skills: ['JavaScript', 'React'],
  experience: [],
  projects: [],
  education: [],
}

const structuredJd: StructuredJD = {
  requirements: [
    {
      id: 'skill_react',
      name: 'React',
      category: 'technical_capability',
      importance: 'high',
      provenance: { exactQuote: 'React', context: null },
    },
  ],
}

const matrix = (satisfaction: string): EvidenceMatrix => ({
  evaluations: [
    {
      capabilityId: 'skill_react',
      satisfaction,
      evidenceStrength: 'weak',
      evidenceReferences: [],
      confidence: 0.9,
      semanticReasoning: 'test',
      gapReason: satisfaction === 'none' ? 'No React evidence found' : null,
    },
  ],
} as unknown as EvidenceMatrix)

const baseInput = {
  resume,
  jobDescription: 'x'.repeat(120),
  targetRole: 'Frontend Engineer',
  companyName: 'Acme',
  userId: 'user-1',
}

describe('startOptimizationRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an honest error when JD extraction fails, without generating anything', async () => {
    extractJDIntelligence.mockResolvedValue({ success: false, error: 'provider down' })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(false)
    if (!outcome.success) expect(outcome.error).toBe('provider down')
    expect(evaluateResumeEvidence).not.toHaveBeenCalled()
    expect(generatePolishedResume).not.toHaveBeenCalled()
  })

  it('a weak baseline (full tier) gets a real score, suggestions, and a scored polished resume', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence
      .mockResolvedValueOnce({ success: true, data: matrix('none') }) // baseline eval
      .mockResolvedValueOnce({ success: true, data: matrix('complete') }) // polished eval
    calculateAtsV2Score
      .mockReturnValueOnce({ overallScore: 40 }) // baseline
      .mockReturnValueOnce({ overallScore: 75 }) // polished
    generatePolishedResume.mockResolvedValue({ success: true, resume: { ...resume, summary: 'Rewritten' } })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.tier).toBe('full')
    expect(outcome.result.baselineScore).toBe(40)
    expect(outcome.result.suggestions.length).toBeGreaterThan(0)
    expect(outcome.result.polishedResume).toBeDefined()
    expect(outcome.result.polishedScore).toBe(75)
    expect(outcome.result.warning).toBeUndefined()
  })

  it('a full-tier run with zero suggestions generates Resume B immediately, since there is no checklist to ever unlock it', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence
      .mockResolvedValueOnce({ success: true, data: matrix('complete') }) // baseline eval — no gaps, so zero suggestions
      .mockResolvedValueOnce({ success: true, data: matrix('complete') }) // polished eval
      .mockResolvedValueOnce({ success: true, data: matrix('complete') }) // target eval
    calculateAtsV2Score
      .mockReturnValueOnce({ overallScore: 40 }) // baseline — still 'full' tier despite full evidence coverage
      .mockReturnValueOnce({ overallScore: 75 }) // polished
      .mockReturnValueOnce({ overallScore: 82 }) // target
    generatePolishedResume.mockResolvedValue({ success: true, resume: { ...resume, summary: 'Rewritten' } })
    generateTargetResume.mockResolvedValue({ success: true, resume: { ...resume, summary: 'Rewritten for role' } })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.tier).toBe('full')
    expect(outcome.result.suggestions).toHaveLength(0)
    expect(outcome.result.targetResume).toBeDefined()
    expect(outcome.result.targetScore).toBe(82)
    expect(generateTargetResume).toHaveBeenCalledTimes(1)
  })

  it('does not attempt Resume B when the full-tier run has suggestions still pending', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence
      .mockResolvedValueOnce({ success: true, data: matrix('none') }) // baseline — has a real gap
      .mockResolvedValueOnce({ success: true, data: matrix('complete') }) // polished eval
    calculateAtsV2Score
      .mockReturnValueOnce({ overallScore: 40 })
      .mockReturnValueOnce({ overallScore: 75 })
    generatePolishedResume.mockResolvedValue({ success: true, resume: { ...resume, summary: 'Rewritten' } })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.suggestions.length).toBeGreaterThan(0)
    expect(outcome.result.targetResume).toBeUndefined()
    expect(generateTargetResume).not.toHaveBeenCalled()
  })

  it('a 90+ baseline generates nothing, even though the AI could technically be called', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence.mockResolvedValueOnce({ success: true, data: matrix('complete') })
    calculateAtsV2Score.mockReturnValueOnce({ overallScore: 95 })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.tier).toBe('already_strong')
    expect(outcome.result.polishedResume).toBeUndefined()
    expect(generatePolishedResume).not.toHaveBeenCalled()
  })

  it('keeps the real baseline score and adds a warning when generation fails, rather than failing the whole run', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence.mockResolvedValueOnce({ success: true, data: matrix('none') })
    calculateAtsV2Score.mockReturnValueOnce({ overallScore: 40 })
    generatePolishedResume.mockResolvedValue({ success: false, error: 'fabrication detected twice' })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.baselineScore).toBe(40)
    expect(outcome.result.polishedResume).toBeUndefined()
    expect(outcome.result.warning).toBe('fabrication detected twice')
  })

  it('does not show a generated resume that was produced but could not be scored', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    evaluateResumeEvidence
      .mockResolvedValueOnce({ success: true, data: matrix('none') })
      .mockResolvedValueOnce({ success: false, error: 'eval failed' })
    calculateAtsV2Score.mockReturnValueOnce({ overallScore: 40 })
    generatePolishedResume.mockResolvedValue({ success: true, resume: { ...resume, summary: 'Rewritten' } })

    const outcome = await startOptimizationRun(baseInput)

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.result.polishedResume).toBeUndefined()
    expect(outcome.result.polishedScore).toBeUndefined()
    expect(outcome.result.warning).toMatch(/could not be scored/)
  })
})

describe('runTargetGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const completed: Suggestion[] = [
    {
      id: 'skill_react',
      type: 'skill',
      title: 'Learn React',
      detail: 'x',
      requirement: 'React',
      importance: 'high',
      completed: true,
      completed_at: new Date().toISOString(),
    },
  ]

  it('scores the target resume with the real engine, reusing the original structuredJd', async () => {
    generateTargetResume.mockResolvedValue({ success: true, resume: { ...resume, skills: ['JavaScript', 'React'] } })
    evaluateResumeEvidence.mockResolvedValue({ success: true, data: matrix('complete') })
    calculateAtsV2Score.mockReturnValueOnce({ overallScore: 88 })

    const outcome = await runTargetGeneration({
      ...baseInput,
      structuredJd,
      completedSuggestions: completed,
    })

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.score).toBe(88)
    expect(extractJDIntelligence).not.toHaveBeenCalled()
    expect(evaluateResumeEvidence).toHaveBeenCalledWith(expect.anything(), structuredJd, baseInput.userId)
  })

  it('does not persist a target resume that could not be scored', async () => {
    generateTargetResume.mockResolvedValue({ success: true, resume: { ...resume, skills: ['JavaScript', 'React'] } })
    evaluateResumeEvidence.mockResolvedValue({ success: false, error: 'timeout' })

    const outcome = await runTargetGeneration({
      ...baseInput,
      structuredJd,
      completedSuggestions: completed,
    })

    expect(outcome.success).toBe(false)
    if (outcome.success) return
    expect(outcome.error).toMatch(/could not be scored/i)
  })

  it('re-extracts the JD when structuredJd was not persisted, then scores against it', async () => {
    extractJDIntelligence.mockResolvedValue({ success: true, data: structuredJd })
    generateTargetResume.mockResolvedValue({ success: true, resume: { ...resume, skills: ['JavaScript', 'React'] } })
    evaluateResumeEvidence.mockResolvedValue({ success: true, data: matrix('complete') })
    calculateAtsV2Score.mockReturnValueOnce({ overallScore: 82 })

    const outcome = await runTargetGeneration({
      ...baseInput,
      completedSuggestions: completed,
    })

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.score).toBe(82)
    expect(extractJDIntelligence).toHaveBeenCalledTimes(1)
  })

  it('surfaces generation failure honestly instead of a fallback score', async () => {
    generateTargetResume.mockResolvedValue({ success: false, error: 'fabrication detected twice' })

    const outcome = await runTargetGeneration({
      ...baseInput,
      structuredJd,
      completedSuggestions: completed,
    })

    expect(outcome.success).toBe(false)
    if (outcome.success) return
    expect(outcome.error).toBe('fabrication detected twice')
  })
})
