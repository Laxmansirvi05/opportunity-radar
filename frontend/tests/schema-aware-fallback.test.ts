import { describe, it, expect, vi } from 'vitest'
import { callAI } from '../lib/ai-gateway'

vi.mock('../lib/ai-gateway/providers/gemini', () => ({
  callGemini: vi.fn().mockImplementation(async () => {
    // Gemini returns HTTP 200 with invalid schema JSON
    return {
      success: true,
      content: JSON.stringify({ invalidField: 'Not a valid schema output' }),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tokensUsed: { input: 100, output: 50, total: 150 },
      latencyMs: 150,
    }
  }),
}))

vi.mock('../lib/ai-gateway/providers/openrouter', () => ({
  callOpenRouter: vi.fn().mockImplementation(async () => {
    // OpenRouter succeeds with valid schema JSON
    return {
      success: true,
      content: JSON.stringify({
        requirements: [
          {
            id: 'req_1',
            name: 'React.js',
            category: 'technical_capability',
            importance: 'high',
            description: 'React requirement',
            provenance: { exactQuote: 'React' },
          },
        ],
      }),
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash',
      tokensUsed: { input: 120, output: 60, total: 180 },
      latencyMs: 200,
    }
  }),
}))

describe('Schema-Aware AI Provider Fallback (Phase 3C)', () => {
  it('rejects provider output that fails schema validation and falls back to next provider', async () => {
    const validator = (content: string) => {
      try {
        const parsed = JSON.parse(content)
        if (parsed.requirements && Array.isArray(parsed.requirements)) {
          return { valid: true as const }
        }
        return { valid: false as const, reason: 'Missing requirements array' }
      } catch (e: any) {
        return { valid: false as const, reason: e.message }
      }
    }

    const result = await callAI(
      {
        systemPrompt: 'Extract JD',
        userPrompt: 'React developer',
        outputFormat: 'json',
      },
      {
        feature: 'jd_intelligence',
        validator,
      }
    )

    // Gemini succeeded at API level but failed validator.
    // System automatically fell back to OpenRouter which passed validator!
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.provider).toBe('openrouter')
      expect(result.content).toContain('React.js')
    }
  })
})
