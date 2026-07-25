import {
  type AIRequest,
  type AIResult,
  type GatewayContext,
  isAIResponse,
  estimateCostUsd,
  type AIProvider,
} from '@/types/ai'
import { callGemini } from './providers/gemini'
import { callGroq } from './providers/groq'
import { callOpenRouter } from './providers/openrouter'
import { callCloudflare } from './providers/cloudflare'
import { callOllama } from './providers/ollama'
import { createClient } from '@supabase/supabase-js'
import {
  isProviderHealthy,
  recordProviderFailure,
  recordProviderSuccess,
} from './health'

const TIMEOUTS: Record<AIProvider, number> = {
  gemini: 25_000,
  openrouter: 30_000,
  groq: 15_000,
  cloudflare: 10_000,
  ollama: 40_000,
}

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  resume_parser:    { max: 5,   windowMs: 3_600_000 },
  resume_ats:       { max: 10,  windowMs: 3_600_000 },
  resume_optimizer: { max: 20,  windowMs: 86_400_000 },
  skill_extraction: { max: 500, windowMs: 3_600_000 },
}

interface ProviderConfig {
  provider: AIProvider
  model?: string
}

const STRONG_MODELS: ProviderConfig[] = [
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'openrouter', model: 'google/gemini-2.5-flash' }
]

const FAST_CHEAP_MODELS: ProviderConfig[] = [
  { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' },
  { provider: 'gemini', model: 'gemini-2.5-flash' }
]

export function getProviderSequence(feature: string): ProviderConfig[] {
  switch (feature) {
    case 'evidence_evaluation':
    case 'resume_ats_v2_evidence_eval':
      return [
        ...STRONG_MODELS,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'ollama', model: 'gpt-oss:120b' },
        { provider: 'ollama', model: 'nemotron-3-super' }
      ]
    case 'jd_intelligence':
    case 'resume_ats_v2_jd_extract':
      return [
        ...STRONG_MODELS,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'ollama', model: 'gpt-oss:120b' },
        { provider: 'ollama', model: 'nemotron-3-super' }
      ]
    case 'resume_extraction':
    case 'resume_parser':
      return [
        ...STRONG_MODELS,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'ollama', model: 'gpt-oss:120b' },
        { provider: 'ollama', model: 'nemotron-3-super' }
      ]
    case 'schema_repair':
      return [
        ...FAST_CHEAP_MODELS,
        ...STRONG_MODELS
      ]
    case 'hr_coaching':
    case 'resume_ats_coaching':
    case 'resume_ats_general_coaching':
      return [
        ...FAST_CHEAP_MODELS,
        ...STRONG_MODELS
      ]
    case 'resume_optimization':
    case 'resume_optimizer':
      return [
        ...STRONG_MODELS,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' }
      ]
    default:
      return STRONG_MODELS
  }
}

async function logUsage(result: AIResult, context: GatewayContext): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[AI Gateway] Missing Supabase credentials. Skipping usage log.")
    return
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const costUsd =
    isAIResponse(result)
      ? estimateCostUsd(
          result.provider,
          result.tokensUsed.input,
          result.tokensUsed.output
        )
      : 0

  await supabase.from('ai_usage_log').insert({
    feature:        context.feature,
    user_id:        context.userId ?? null,
    opportunity_id: context.opportunityId ?? null,
    provider:       result.provider,
    model:          isAIResponse(result) ? result.model : null,
    tokens_input:   isAIResponse(result) ? result.tokensUsed.input : 0,
    tokens_output:  isAIResponse(result) ? result.tokensUsed.output : 0,
    tokens_total:   isAIResponse(result) ? result.tokensUsed.total : 0,
    latency_ms:     result.latencyMs,
    success:        result.success,
    failure_reason: !result.success ? result.reason : null,
    estimated_cost: costUsd,
  })
}

async function checkRateLimit(
  userId: string | undefined,
  feature: string
): Promise<boolean> {
  if (!userId) return true
  const limit = RATE_LIMITS[feature]
  if (!limit) return true

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabase.rpc('check_ai_rate_limit', {
    p_user_id:   userId,
    p_feature:   feature,
    p_max:       limit.max,
    p_window_ms: limit.windowMs,
  })

  if (error) {
    console.error('[RateLimit] RPC Error:', error)
    return true
  }

  return (data as { allowed: boolean }[])?.[0]?.allowed ?? false
}

export async function callAI(
  request: AIRequest,
  context: GatewayContext
): Promise<AIResult> {
  const allowed = await checkRateLimit(context.userId, context.feature)
  if (!allowed) {
    const err: AIResult = {
      success:    false,
      provider:   'all',
      reason:     'rate_limit',
      latencyMs:  0,
    }
    console.error(`[AI Gateway] User rate limit exceeded for feature: ${context.feature}`)
    await logUsage(err, context)
    return err
  }

  const sequence = getProviderSequence(context.feature)
  let totalLatency = 0

  for (const config of sequence) {
    if (!isProviderHealthy(config.provider, config.model!)) {
      console.warn(`[AI Gateway] Skipping ${config.provider} (${config.model}) due to health backoff.`)
      continue
    }

    console.log(`[AI Gateway] Attempting ${config.provider} (${config.model}) for task: ${context.feature}`)
    
    let result: AIResult
    const timeout = TIMEOUTS[config.provider]

    switch (config.provider) {
      case 'gemini':
        result = await callGemini(request, timeout, config.model!)
        if (isAIResponse(result)) result.model = config.model!
        break
      case 'groq':
        result = await callGroq(request, timeout, config.model!)
        break
      case 'openrouter':
        result = await callOpenRouter(request, timeout, config.model!)
        if (isAIResponse(result)) result.model = config.model!
        break
      case 'cloudflare':
        result = await callCloudflare(request, timeout, config.model!)
        break
      case 'ollama':
        result = await callOllama(request, timeout, config.model!)
        break
      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }

    totalLatency += result.latencyMs

    if (result.success) {
      if (context.validator) {
        try {
          const validationResult = await Promise.resolve(context.validator(result.content))
          if (!validationResult.valid) {
            console.warn(`[AI Gateway] SCHEMA_FAILURE: ${config.provider} (${config.model}) - Reason: ${validationResult.reason}`)
            result = {
              success: false,
              provider: config.provider,
              reason: 'schema_failure',
              latencyMs: result.latencyMs
            }
          }
        } catch (error: any) {
          console.warn(`[AI Gateway] SCHEMA_FAILURE: ${config.provider} (${config.model}) - Exception: ${error.message}`)
          result = {
            success: false,
            provider: config.provider,
            reason: 'schema_failure',
            latencyMs: result.latencyMs
          }
        }
      }

      if (result.success) {
        console.log(`[AI Gateway] SUCCESS: ${config.provider} (${config.model})`)
        recordProviderSuccess(config.provider, config.model!)
        await logUsage(result, context)
        return result
      }
    }

    console.warn(`[AI Gateway] Failed: ${config.provider} (${config.model}) - Reason: ${!result.success ? result.reason : 'provider_error'}`)
    recordProviderFailure(config.provider, config.model!, !result.success ? result.reason : 'provider_error')
  }

  console.error(`[AI Gateway] FATAL: All qualified providers failed for task: ${context.feature}`)
  const allFailed: AIResult = {
    success:   false,
    provider:  'all',
    reason:    'all_failed',
    latencyMs: totalLatency,
  }
  await logUsage(allFailed, context)
  return allFailed
}
