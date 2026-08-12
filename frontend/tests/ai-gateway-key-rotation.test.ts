import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callAI } from '@/lib/ai-gateway/index'
import { resetProviderHealth } from '@/lib/ai-gateway/health'
import { callGroq } from '@/lib/ai-gateway/providers/groq'
import { callGemini } from '@/lib/ai-gateway/providers/gemini'
import { callOpenRouter } from '@/lib/ai-gateway/providers/openrouter'
import { callMistral } from '@/lib/ai-gateway/providers/mistral'
import { callCloudflare } from '@/lib/ai-gateway/providers/cloudflare'
import { callOllama } from '@/lib/ai-gateway/providers/ollama'
import type { AIRequest, GatewayContext, AIResult } from '@/types/ai'

vi.mock('@/lib/ai-gateway/providers/gemini', () => ({ callGemini: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/groq', () => ({ callGroq: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/openrouter', () => ({ callOpenRouter: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/ollama', () => ({ callOllama: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/cloudflare', () => ({ callCloudflare: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/mistral', () => ({ callMistral: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    rpc: vi.fn().mockResolvedValue({ data: [{ allowed: true }] }),
  }),
}))

/**
 * These tests exist because demo-day resilience — multiple keys per
 * provider, provided so a live demo doesn't stall on one account's rate
 * limit — is new behaviour with no prior coverage. `ai-routing.test.ts`
 * covers cross-provider fallback with zero keys configured (the pre-existing
 * single-key-per-provider shape); these cover the new same-provider,
 * multi-key rotation layered on top of it.
 */
describe('AI Gateway multi-key rotation', () => {
  const req: AIRequest = { systemPrompt: 'test', userPrompt: 'test' }

  const ok = (provider: any, model = 'm'): AIResult => ({
    success: true, provider, model, content: 'mock',
    tokensUsed: { input: 1, output: 1, total: 2 }, latencyMs: 50,
  })
  const fail = (provider: any, reason: any = 'rate_limit'): AIResult => ({
    success: false, provider, reason, latencyMs: 50,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    resetProviderHealth()
    process.env.GROQ_API_KEY = 'groq-key-1'
    process.env.GROQ_API_KEY_2 = 'groq-key-2'
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY_2
    delete process.env.GROQ_API_KEY_3
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY_2
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  })

  it('a rate-limited first key falls through to the second key of the SAME provider before trying a different provider', async () => {
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(fail('openrouter')) // sits before groq in the sequence
    vi.mocked(callGroq)
      .mockResolvedValueOnce(fail('groq', 'rate_limit')) // key 1
      .mockResolvedValueOnce(ok('groq'))                 // key 2

    const ctx: GatewayContext = { feature: 'resume_optimizer' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(true)
    expect(callGroq).toHaveBeenCalledTimes(2)
    // Provider adapters receive the key as their 4th argument.
    expect(vi.mocked(callGroq).mock.calls[0][3]).toBe('groq-key-1')
    expect(vi.mocked(callGroq).mock.calls[1][3]).toBe('groq-key-2')
  })

  it('exhausting every key of a provider falls through to the next provider in the sequence', async () => {
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(fail('openrouter'))
    vi.mocked(callGroq).mockResolvedValue(fail('groq', 'rate_limit')) // both keys fail
    vi.mocked(callMistral).mockResolvedValue(ok('mistral'))

    const ctx: GatewayContext = { feature: 'resume_optimizer' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(true)
    expect(result.success && result.provider).toBe('mistral')
    expect(callGroq).toHaveBeenCalledTimes(2) // tried both keys, neither worked
    expect(callMistral).toHaveBeenCalledTimes(1)
  })

  it('a rate-limited key is skipped on the next call while its sibling key is not', async () => {
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(fail('openrouter'))
    vi.mocked(callGroq)
      .mockResolvedValueOnce(fail('groq', 'rate_limit')) // key 1 fails
      .mockResolvedValueOnce(ok('groq'))                 // key 2 succeeds

    const ctx: GatewayContext = { feature: 'resume_optimizer' }
    await callAI(req, ctx)
    expect(callGroq).toHaveBeenCalledTimes(2)

    // Second call: key 1 is still in backoff, so only key 2 should be tried.
    vi.clearAllMocks()
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(fail('openrouter'))
    vi.mocked(callGroq).mockResolvedValue(ok('groq'))

    const result = await callAI(req, ctx)
    expect(result.success).toBe(true)
    expect(callGroq).toHaveBeenCalledTimes(1)
    expect(vi.mocked(callGroq).mock.calls[0][3]).toBe('groq-key-2')
  })

  it('a provider with zero configured keys still gets one attempt with apiKey=undefined, not skipped outright', async () => {
    // getProviderApiKeys finds nothing, so keyAttempts falls back to
    // [undefined] — the real (unmocked) provider function then falls back
    // to its own process.env read internally, same as before this feature
    // existed. That single attempt is expected to fail fast (no key
    // anywhere) and the gateway must still move on to the next provider.
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY_2
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(fail('openrouter'))
    vi.mocked(callGroq).mockResolvedValue(fail('groq', 'auth_failure'))
    vi.mocked(callMistral).mockResolvedValue(ok('mistral'))

    const ctx: GatewayContext = { feature: 'resume_optimizer' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(true)
    expect(result.success && result.provider).toBe('mistral')
    expect(callGroq).toHaveBeenCalledTimes(1)
    expect(vi.mocked(callGroq).mock.calls[0][3]).toBeUndefined()
  })

  it('a single-key provider (no numbered siblings) behaves exactly as before', async () => {
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY_2
    vi.mocked(callGemini).mockResolvedValue(fail('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(ok('openrouter'))

    const ctx: GatewayContext = { feature: 'resume_optimizer' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(true)
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(callOpenRouter).toHaveBeenCalledTimes(1)
  })
})
