import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callAI } from '@/lib/ai-gateway'
import { resetProviderHealth } from '@/lib/ai-gateway/health'
import { callGemini } from '@/lib/ai-gateway/providers/gemini'
import type { AIRequest, AIFeature } from '@/types/ai'

/**
 * SEC-01: `checkRateLimit` used to do `if (!limit) return true`, so any
 * AIFeature without an explicit RATE_LIMITS entry was completely unlimited.
 * This proves the fallback default actually caps an undeclared feature,
 * rather than trusting the source comment.
 */

vi.mock('@/lib/ai-gateway/providers/gemini', () => ({ callGemini: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/groq', () => ({ callGroq: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/openrouter', () => ({ callOpenRouter: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/ollama', () => ({ callOllama: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/cloudflare', () => ({ callCloudflare: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    // Simulate the DB backstop being unreachable/absent so the in-memory
    // cap (what the fallback default actually adds) is what gets exercised.
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'no rpc' } }),
  }),
}))

const req: AIRequest = { systemPrompt: 'test', userPrompt: 'test' }
const mockSuccess = {
  success: true as const,
  provider: 'gemini' as const,
  model: 'gemini-2.5-flash',
  content: 'ok',
  tokensUsed: { input: 1, output: 1, total: 2 },
  latencyMs: 10,
}

describe('AI Gateway default rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProviderHealth()
    vi.mocked(callGemini).mockResolvedValue(mockSuccess)
  })

  it('caps a feature with no explicit RATE_LIMITS entry instead of allowing it unlimited', async () => {
    const userId = `sec01-${crypto.randomUUID()}`
    // 'assistant' is a real AIFeature with no RATE_LIMITS entry (see SEC-01) —
    // exactly the case this fallback exists to close.
    const feature: AIFeature = 'assistant'

    for (let i = 0; i < 30; i++) {
      const result = await callAI(req, { feature, userId })
      expect(result.success).toBe(true)
    }

    const capped = await callAI(req, { feature, userId })
    expect(capped.success).toBe(false)
    if (!capped.success) expect(capped.reason).toBe('rate_limit')
  })

  it('does not rate-limit anonymous (no userId) calls', async () => {
    const feature: AIFeature = 'jd_intelligence'
    for (let i = 0; i < 40; i++) {
      const result = await callAI(req, { feature })
      expect(result.success).toBe(true)
    }
  })
})
