import {
  type AIRequest,
  type AIResult,
  type GatewayContext,
  isAIResponse,
  estimateCostUsd,
} from '@/types/ai'
import { callGemini } from './providers/gemini'
import { callGroq } from './providers/groq'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GEMINI_TIMEOUT_MS = 10_000
const GROQ_TIMEOUT_MS   = 8_000
const GEMINI_RETRY_WAIT = 1_000

// ---------------------------------------------------------------------------
// Rate limit configuration per feature
// ---------------------------------------------------------------------------
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  resume_parser:    { max: 5,   windowMs: 3_600_000 },   // 5/hour
  resume_ats:       { max: 10,  windowMs: 3_600_000 },
  resume_optimizer: { max: 20,  windowMs: 86_400_000 },  // 20/day
  skill_extraction: { max: 500, windowMs: 3_600_000 },   // 500/hour (server-side only)
}

// ---------------------------------------------------------------------------
// Internal: write log row to ai_usage_log
// ---------------------------------------------------------------------------
async function logUsage(result: AIResult, context: GatewayContext): Promise<void> {
  // Use service role client for writes — this runs server-side only
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    provider:       isAIResponse(result) ? result.provider : result.provider,
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

// ---------------------------------------------------------------------------
// Internal: check rate limit via DB RPC
// ---------------------------------------------------------------------------
async function checkRateLimit(
  userId: string | undefined,
  feature: string
): Promise<boolean> {
  if (!userId) return true  // Server-side calls (extraction pipeline) are not rate-limited
  const limit = RATE_LIMITS[feature]
  if (!limit) return true

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.rpc('check_ai_rate_limit', {
    p_user_id:   userId,
    p_feature:   feature,
    p_max:       limit.max,
    p_window_ms: limit.windowMs,
  })

  if (error) {
    console.error('[RateLimit] RPC Error:', error)
    return true // Default to allowed if RPC is missing
  }

  return (data as { allowed: boolean }[])?.[0]?.allowed ?? false
}

// ---------------------------------------------------------------------------
// Internal: sleep helper
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Main Gateway Entry Point
// All AI calls across the platform MUST use this function.
// No feature module may call Gemini or Groq directly.
// ---------------------------------------------------------------------------
export async function callAI(
  request: AIRequest,
  context: GatewayContext
): Promise<AIResult> {
  // 1. Rate limit check
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

  // 2. Try Gemini Flash (primary)
  console.log(`[AI Gateway] Attempting Primary Provider: Gemini (gemini-2.5-flash) for feature: ${context.feature}`)
  const geminiResult = await callGemini(request, GEMINI_TIMEOUT_MS)
  if (geminiResult.success) {
    console.log(`[AI Gateway] SUCCESS: Gemini (gemini-2.5-flash)`)
    await logUsage(geminiResult, context)
    return geminiResult
  }

  // 3. Retry Gemini ONLY if appropriate
  let geminiRetry = geminiResult
  if (geminiResult.reason !== 'rate_limit') {
    console.warn(`[AI Gateway] Gemini failed (reason: ${geminiResult.reason}). Retrying once…`)
    await sleep(GEMINI_RETRY_WAIT)
    geminiRetry = await callGemini(request, GEMINI_TIMEOUT_MS)
    if (geminiRetry.success) {
      console.log(`[AI Gateway] SUCCESS (after retry): Gemini (gemini-2.5-flash)`)
      await logUsage(geminiRetry, context)
      return geminiRetry
    }
  } else {
    console.warn(`[AI Gateway] Gemini failed with rate_limit (429 Quota Exceeded). Skipping retry.`)
  }

  // 4. Fallback to Groq
  console.warn(`[AI Gateway] Primary provider exhausted (reason: ${geminiRetry.reason}). Falling back to Groq…`)
  const groqResult = await callGroq(request, GROQ_TIMEOUT_MS)
  if (groqResult.success) {
    console.log(`[AI Gateway] SUCCESS (Fallback): Groq (${groqResult.model})`)
    await logUsage(groqResult, context)
    return groqResult
  }

  // 5. Both providers failed
  console.error(`[AI Gateway] FATAL: All providers failed for feature: ${context.feature}. Gemini: ${geminiRetry.reason}, Groq: ${groqResult.reason}`)
  const allFailed: AIResult = {
    success:   false,
    provider:  'all',
    reason:    'all_failed',
    latencyMs: geminiRetry.latencyMs + groqResult.latencyMs,
  }
  await logUsage(allFailed, context)
  return allFailed
}
