import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callAI, getProviderSequence } from '@/lib/ai-gateway/index'
import { resetProviderHealth, isProviderHealthy, recordProviderFailure } from '@/lib/ai-gateway/health'
import { callGemini } from '@/lib/ai-gateway/providers/gemini'
import { callGroq } from '@/lib/ai-gateway/providers/groq'
import { callOpenRouter } from '@/lib/ai-gateway/providers/openrouter'
import { callOllama } from '@/lib/ai-gateway/providers/ollama'
import { callCloudflare } from '@/lib/ai-gateway/providers/cloudflare'
import type { AIRequest, GatewayContext, AIResult } from '@/types/ai'

vi.mock('@/lib/ai-gateway/providers/gemini', () => ({ callGemini: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/groq', () => ({ callGroq: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/openrouter', () => ({ callOpenRouter: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/ollama', () => ({ callOllama: vi.fn() }))
vi.mock('@/lib/ai-gateway/providers/cloudflare', () => ({ callCloudflare: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    rpc: vi.fn().mockResolvedValue({ data: [{ allowed: true }] }),
  }),
}))

describe('AI Gateway Task-Based Routing (Phase 2.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProviderHealth()
  })

  const req: AIRequest = { systemPrompt: 'test', userPrompt: 'test' }
  const getMockResult = (provider: any, model: string): AIResult => ({
    success: true,
    provider,
    model,
    content: 'mock',
    tokensUsed: { input: 1, output: 1, total: 2 },
    latencyMs: 100,
  })

  const getMockError = (provider: any, reason: any = 'provider_error'): AIResult => ({
    success: false,
    provider,
    reason,
    latencyMs: 100,
  })

  it('evidence evaluation never reaches 8B judge', () => {
    const sequence = getProviderSequence('evidence_evaluation')
    const has8B = sequence.some(s => s.model?.includes('8b') || s.model?.includes('8B'))
    expect(has8B).toBe(false)
  })

  it('Ollama qualified judge routing works and Nemotron is a deep fallback', async () => {
    const sequence = getProviderSequence('evidence_evaluation')
    expect(sequence.some(s => (s.provider as string) === 'ollama' && s.model === 'gpt-oss:120b')).toBe(true)
    
    const nemotronIndex = sequence.findIndex(s => s.provider === 'ollama' && s.model === 'nemotron-3-super')
    expect(nemotronIndex).toBeGreaterThan(0)
    expect(nemotronIndex).toBe(sequence.length - 1) // Should be the very last fallback
  })

  it('qualified-provider failure returns controlled failure', async () => {
    vi.mocked(callGemini).mockResolvedValue(getMockError('gemini'))
    vi.mocked(callOpenRouter).mockResolvedValue(getMockError('openrouter'))
    vi.mocked(callOllama).mockResolvedValue(getMockError('ollama'))
    vi.mocked(callGroq).mockResolvedValue(getMockError('groq'))

    const ctx: GatewayContext = { feature: 'evidence_evaluation' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('all_failed')
      expect(result.provider).toBe('all')
    }
  })

  it('rate-limited provider is skipped appropriately on subsequent calls', async () => {
    // 1st call: Gemini rate limits
    vi.mocked(callGemini).mockResolvedValue(getMockError('gemini', 'rate_limit'))
    vi.mocked(callOpenRouter).mockResolvedValue(getMockResult('openrouter', 'google/gemini-2.5-flash'))

    const ctx: GatewayContext = { feature: 'evidence_evaluation' }
    
    // Call 1
    await callAI(req, ctx)
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(callOpenRouter).toHaveBeenCalledTimes(1)

    // Call 2
    vi.clearAllMocks()
    await callAI(req, ctx)
    // Gemini should be skipped, straight to OpenRouter
    expect(callGemini).toHaveBeenCalledTimes(0)
    expect(callOpenRouter).toHaveBeenCalledTimes(1)
  })

  it('schema failure moves to another qualified model', async () => {
    // 1st call fails schema_failure, 2nd succeeds
    vi.mocked(callGemini).mockResolvedValue(getMockError('gemini', 'schema_failure'))
    vi.mocked(callOpenRouter).mockResolvedValue(getMockResult('openrouter', 'google/gemini-2.5-flash'))

    const ctx: GatewayContext = { feature: 'evidence_evaluation' }
    const result = await callAI(req, ctx)

    expect(result.success).toBe(true)
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(callOpenRouter).toHaveBeenCalledTimes(1)
  })

  it('no infinite retry/fallback loop', async () => {
    vi.mocked(callGemini).mockResolvedValue(getMockError('gemini'))
    vi.mocked(callGroq).mockResolvedValue(getMockError('groq'))
    vi.mocked(callOpenRouter).mockResolvedValue(getMockError('openrouter'))
    vi.mocked(callOllama).mockResolvedValue(getMockError('ollama'))
    vi.mocked(callCloudflare).mockResolvedValue(getMockError('cloudflare'))

    const ctx: GatewayContext = { feature: 'schema_repair' }
    const result = await callAI(req, ctx)
    
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('all_failed')
    }
    // Should call Cloudflare, Gemini, OpenRouter exactly once based on schema_repair sequence
    expect(callCloudflare).toHaveBeenCalledTimes(1)
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(callOpenRouter).toHaveBeenCalledTimes(1)
  })

  it('Voyage/Jina remain outside LLM generative routing', () => {
    // Just verify none of the sequences return voyage or jina
    const tasks = [
      'evidence_evaluation', 'jd_intelligence', 'resume_extraction', 
      'schema_repair', 'hr_coaching', 'resume_optimization'
    ]
    for (const task of tasks) {
      const sequence = getProviderSequence(task)
      const hasSemantic = sequence.some(s => (s.provider as string) === 'voyage' || (s.provider as string) === 'jina')
      expect(hasSemantic).toBe(false)
    }
  })

  it('unknown task fails safely rather than using arbitrary routing', () => {
    const sequence = getProviderSequence('unknown_task_123')
    // Defaults to STRONG_MODELS safely instead of crashing or defaulting to weak
    expect(sequence.length).toBeGreaterThan(0)
    expect(sequence[0].provider).toBe('gemini')
  })
})
