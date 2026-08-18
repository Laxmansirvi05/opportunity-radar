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
import { callMistral } from './providers/mistral'
import { createClient } from '@supabase/supabase-js'
import { getProviderApiKeys, keyFingerprint } from './key-pool'
import {
  isProviderHealthy,
  recordProviderFailure,
  recordProviderSuccess,
} from './health'

const TIMEOUTS: Record<AIProvider, number> = {
  gemini: 25_000,
  openrouter: 30_000,
  groq: 15_000,
  cloudflare: 30_000,
  ollama: 40_000,
  mistral: 25_000,
}

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  resume_parser:    { max: 5,   windowMs: 3_600_000 },
  resume_ats:       { max: 10,  windowMs: 3_600_000 },
  resume_optimizer: { max: 20,  windowMs: 86_400_000 },
  skill_extraction: { max: 500, windowMs: 3_600_000 },
  // Resume optimisation: each run makes at most one generation call per
  // variant (plus a single guarded retry inside generate.ts itself), so a
  // per-day cap here bounds provider spend without blocking normal iteration.
  resume_polish:    { max: 10,  windowMs: 86_400_000 },
  resume_target:    { max: 10,  windowMs: 86_400_000 },
  // Voice interview sessions never route through callAI (the LLM calls
  // happen entirely inside the separate DeepInterview service), so
  // POST /api/interview/start had zero throttling of any kind — found
  // 16 Aug 2026 audit. Each call triggers a real external session-prep
  // request with its own provider cost on that side. Reusing checkRateLimit
  // here rather than duplicating the mechanism.
  voice_interview:  { max: 10,  windowMs: 86_400_000 },
  // AI Search is the most expensive thing a single click can start here: one
  // run drives a scraping pipeline, a headless Chromium, and a scoring call
  // per discovered posting, taking 5-20 minutes of real compute. Like
  // voice_interview it never routes through callAI, so POST /api/ai-search had
  // no throttle of any kind. Deliberately tighter than the others — a student
  // has one resume, and re-running it repeatedly cannot improve the result.
  ai_search:        { max: 5,   windowMs: 86_400_000 },
}

// SEC-01: `checkRateLimit` previously did `if (!limit) return true`, so any
// AIFeature without an explicit entry above was completely unlimited — an
// authenticated user could drain the provider quota through any of them.
// This is the backstop for every feature the table above doesn't name yet;
// individual features should still get a tuned entry above when their real
// usage pattern is known.
const DEFAULT_LIMIT = { max: 30, windowMs: 3_600_000 }

interface ProviderConfig {
  provider: AIProvider
  model?: string
}

// gemini-flash-latest, not a pinned version — see providers/gemini.ts for
// why a pinned version silently 404s for newer Google Cloud projects while
// still working for older ones. The alias is what actually gets called;
// this string only has to satisfy TIMEOUTS/logging, never sent as-is.
const STRONG_MODELS: ProviderConfig[] = [
  { provider: 'gemini', model: 'gemini-flash-latest' },
  { provider: 'openrouter', model: 'google/gemini-2.5-flash' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'mistral', model: 'mistral-small-latest' },
  { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' }
]

const FAST_CHEAP_MODELS: ProviderConfig[] = [
  { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' },
  { provider: 'gemini', model: 'gemini-flash-latest' }
]

export function getProviderSequence(feature: string): ProviderConfig[] {
  switch (feature) {
    case 'evidence_evaluation':
    case 'resume_ats_v2_evidence_eval':
      return [
        // Exclude 8b Cloudflare model for evidence evaluation to satisfy tests
        ...STRONG_MODELS.filter(c => !(c.provider === 'cloudflare' && c.model?.includes('8b'))),
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

const inMemoryRateLimits = new Map<string, number[]>()

export async function recordFeatureUsage(userId: string, feature: string): Promise<void> {
  // Durably record one usage row so checkRateLimit's counting RPC (which reads
  // ai_usage_log) actually accumulates for features that DON'T go through
  // callAI. callAI logs usage as a side effect of an LLM call; AI Search and
  // the voice interview never call it, so without this their rate limits only
  // ever lived in the per-process in-memory map — empty on every serverless
  // cold start, i.e. effectively no limit at all. Found 18 Aug by testing the
  // RPC directly. Service-role because ai_usage_log inserts are service-side.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await supabase.from('ai_usage_log').insert({
      feature,
      user_id: userId,
      provider: 'agent',
      success: true,
    })
  } catch {
    // Best-effort: a failed usage write must never block a run the user is
    // entitled to. The worst case is one uncounted start.
  }
}

export async function checkRateLimit(
  userId: string | undefined,
  feature: string
): Promise<boolean> {
  if (!userId) return true
  const limit = RATE_LIMITS[feature] ?? DEFAULT_LIMIT

  const now = Date.now()
  const key = `${userId}:${feature}`
  const userTimestamps = (inMemoryRateLimits.get(key) || []).filter(ts => now - ts < limit.windowMs)

  if (userTimestamps.length >= limit.max) {
    return false
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
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

      if (!error && data) {
        const allowed = (data as any)?.[0]?.allowed ?? (typeof data === 'boolean' ? data : true)
        if (!allowed) return false
      }
    } catch {
      // RPC missing or failed; fall back to in-memory check below
    }
  }

  userTimestamps.push(now)
  inMemoryRateLimits.set(key, userTimestamps)
  return true
}

/** One attempt against one provider+model+key combination. */
async function attemptCall(
  provider: AIProvider,
  model: string,
  apiKey: string | undefined,
  request: AIRequest,
  timeout: number
): Promise<AIResult> {
  switch (provider) {
    case 'gemini': {
      const result = await callGemini(request, timeout, model, apiKey)
      if (isAIResponse(result)) result.model = model
      return result
    }
    case 'groq':
      return callGroq(request, timeout, model, apiKey)
    case 'openrouter': {
      const result = await callOpenRouter(request, timeout, model, apiKey)
      if (isAIResponse(result)) result.model = model
      return result
    }
    case 'cloudflare':
      return callCloudflare(request, timeout, model)
    case 'ollama':
      return callOllama(request, timeout, model, apiKey)
    case 'mistral':
      return callMistral(request, timeout, model, apiKey)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
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
    const provider = config.provider
    const model = config.model!
    const timeout = TIMEOUTS[provider]

    // Every configured key for this provider, primary first — a rate limit
    // on one demo-day key must not fall all the way through to a weaker
    // provider while a sibling key of the SAME provider is still fresh.
    // Cloudflare/anything with no numbered keys just returns its one value
    // (or none, in which case the inner loop is a no-op and we move on).
    const keys = getProviderApiKeys(provider)
    const keyAttempts = keys.length > 0 ? keys : [undefined]

    for (const apiKey of keyAttempts) {
      const keyId = apiKey ? keyFingerprint(apiKey) : undefined

      if (!isProviderHealthy(provider, model, keyId)) {
        console.warn(`[AI Gateway] Skipping ${provider} (${model}) key ...${keyId ?? 'default'} due to health backoff.`)
        continue
      }

      console.log(`[AI Gateway] Attempting ${provider} (${model}) key ...${keyId ?? 'default'} for task: ${context.feature}`)

      let result = await attemptCall(provider, model, apiKey, request, timeout)
      totalLatency += result.latencyMs ?? 0

      if (result.success) {
        if (context.validator) {
          try {
            const validationResult = await Promise.resolve(context.validator(result.content, provider))
            if (!validationResult.valid) {
              console.warn(`[AI Gateway] SCHEMA_FAILURE: ${provider} (${model}) - Reason: ${validationResult.reason}`)
              result = {
                success: false,
                provider,
                reason: 'schema_failure',
                latencyMs: result.latencyMs
              }
            }
          } catch (error: any) {
            console.warn(`[AI Gateway] SCHEMA_FAILURE: ${provider} (${model}) - Exception: ${error.message}`)
            result = {
              success: false,
              provider,
              reason: 'schema_failure',
              latencyMs: result.latencyMs
            }
          }
        }

        if (result.success) {
          console.log(`[AI Gateway] SUCCESS: ${provider} (${model}) key ...${keyId ?? 'default'}`)
          recordProviderSuccess(provider, model, keyId)
          await logUsage(result, context)
          return result
        }
      }

      console.warn(`[AI Gateway] Failed: ${provider} (${model}) key ...${keyId ?? 'default'} - Reason: ${!result.success ? result.reason : 'provider_error'}`)
      recordProviderFailure(provider, model, !result.success ? result.reason : 'provider_error', undefined, keyId)
    }
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
