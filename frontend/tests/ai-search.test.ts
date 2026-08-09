import { describe, it, expect } from 'vitest'
import {
  tierPresentation,
  shortfallIsOurFault,
  messageForCode,
  looksLikePdf,
  MAX_RESUME_BYTES,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  type AgentResult,
} from '@/lib/ai-search/agent-client'

/**
 * These pin the parts of the agent's integration contract that are easy to get
 * wrong and expensive to get wrong — chiefly, never presenting a short result
 * list as a failure, and never blaming a student for our own scoring errors.
 */

describe('result tiers', () => {
  it('never presents a short list as an error', () => {
    for (const tier of ['full', 'good', 'limited', 'very_limited', 'none'] as const) {
      const { headline } = tierPresentation(tier, 2)
      expect(headline.toLowerCase()).not.toMatch(/error|failed|problem|wrong/)
    }
  })

  it('hides the feedback banner only on a full result', () => {
    expect(tierPresentation('full', 9).feedbackProminence).toBe('hidden')
    expect(tierPresentation('good', 6).feedbackProminence).toBe('subtle')
    expect(tierPresentation('limited', 3).feedbackProminence).toBe('prominent')
    expect(tierPresentation('very_limited', 1).feedbackProminence).toBe('prominent')
  })

  it('makes feedback the primary message when nothing matched', () => {
    expect(tierPresentation('none', 0).feedbackProminence).toBe('primary')
  })

  it('reads naturally for a single match', () => {
    expect(tierPresentation('very_limited', 1).headline).toBe('1 match found')
  })
})

describe('attributing a shortfall', () => {
  const withReasons = (reasons: string[]): AgentResult => ({
    status: 'weak_profile',
    result_tier: 'limited',
    opportunity_count: 3,
    opportunities: [],
    weak_profile: { reasons },
  })

  it('recognises our own scoring failure', () => {
    // Must never be phrased to the student as a weak resume.
    expect(shortfallIsOurFault(withReasons([
      '8 of 10 opportunities could not be scored (provider errors)',
    ]))).toBe(true)
  })

  it('does not blame us when matches were genuinely few', () => {
    expect(shortfallIsOurFault(withReasons([
      '4 scored below the minimum fit threshold of 50 and were not padded into the results.',
    ]))).toBe(false)
  })

  it('is safe on an absent weak_profile block', () => {
    expect(shortfallIsOurFault(null)).toBe(false)
    expect(shortfallIsOurFault(undefined)).toBe(false)
  })
})

describe('error copy', () => {
  it('explains the .docx-renamed-.pdf case, which is the common one', () => {
    expect(messageForCode('INVALID_FILE_TYPE')).toMatch(/pdf/i)
    expect(messageForCode('INVALID_FILE_TYPE')).toMatch(/word|save as/i)
  })

  it('does not imply the student is at fault for a pipeline failure', () => {
    for (const code of ['PIPELINE_FAILED', 'PIPELINE_TIMEOUT']) {
      expect(messageForCode(code).toLowerCase()).not.toMatch(/your resume|weak/)
    }
  })

  it('falls back rather than returning undefined for an unknown code', () => {
    expect(messageForCode('SOMETHING_NEW')).toBe(messageForCode('INTERNAL_ERROR'))
    expect(messageForCode(undefined)).toBeTruthy()
  })
})

describe('pdf detection', () => {
  const blob = (s: string) => new Blob([s], { type: 'application/pdf' })

  it('accepts a real PDF signature', async () => {
    expect(await looksLikePdf(blob('%PDF-1.7\nrest of file'))).toBe(true)
  })

  it('rejects a non-PDF even when it claims the PDF mime type', async () => {
    // A .docx renamed .pdf is the exact case the agent rejects downstream.
    expect(await looksLikePdf(blob('PK docx payload'))).toBe(false)
    expect(await looksLikePdf(blob('just some text'))).toBe(false)
  })
})

describe('polling constants match the agent guide', () => {
  it('polls every 15s and gives up at 30 minutes', () => {
    expect(POLL_INTERVAL_MS).toBe(15_000)
    expect(POLL_TIMEOUT_MS).toBe(30 * 60_000)
  })

  it('enforces the agent\'s 5 MB upload ceiling', () => {
    expect(MAX_RESUME_BYTES).toBe(5 * 1024 * 1024)
  })
})
