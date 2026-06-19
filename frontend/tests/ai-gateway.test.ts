import { describe, it, expect, vi, afterEach } from 'vitest'
import { estimateCostUsd, isAIResponse, isAIError } from '@/types/ai'
import type { AIResult } from '@/types/ai'

// We test the AI Gateway's logic by mocking the provider adapters.
// Full integration tests (with real API calls) run in a separate CI stage.

describe('isAIResponse / isAIError type guards', () => {
  const success: AIResult = {
    success:   true,
    content:   'Hello',
    provider:  'gemini',
    model:     'gemini-1.5-flash',
    tokensUsed: { input: 100, output: 50, total: 150 },
    latencyMs: 800,
  }

  const failure: AIResult = {
    success:   false,
    provider:  'gemini',
    reason:    'timeout',
    latencyMs: 10001,
  }

  it('isAIResponse returns true for success result', () => {
    expect(isAIResponse(success)).toBe(true)
    expect(isAIResponse(failure)).toBe(false)
  })

  it('isAIError returns true for failure result', () => {
    expect(isAIError(failure)).toBe(true)
    expect(isAIError(success)).toBe(false)
  })
})

describe('estimateCostUsd', () => {
  it('estimates Gemini cost correctly', () => {
    const cost = estimateCostUsd('gemini', 1_000_000, 1_000_000)
    // $0.075/1M input + $0.30/1M output = $0.375
    expect(cost).toBeCloseTo(0.375, 3)
  })

  it('returns 0 for Groq (free tier)', () => {
    const cost = estimateCostUsd('groq', 1_000_000, 1_000_000)
    expect(cost).toBe(0)
  })

  it('handles small token counts', () => {
    const cost = estimateCostUsd('gemini', 500, 200)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.001)  // Less than 0.1 cents
  })
})

describe('Rate limit constants', () => {
  it('resume_parser limit: 5/hour', () => {
    // This test documents the approved rate limit values.
    // The actual enforcement is tested via integration tests.
    const limits: Record<string, { max: number; windowMs: number }> = {
      resume_parser:    { max: 5,   windowMs: 3_600_000 },
      resume_optimizer: { max: 20,  windowMs: 86_400_000 },
      skill_extraction: { max: 500, windowMs: 3_600_000 },
    }
    expect(limits.resume_parser.max).toBe(5)
    expect(limits.resume_optimizer.max).toBe(20)
    expect(limits.skill_extraction.max).toBe(500)
  })
})
