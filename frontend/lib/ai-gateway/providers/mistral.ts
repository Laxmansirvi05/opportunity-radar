import type { AIRequest, AIResult } from '@/types/ai'

/**
 * Mistral's La Plateforme — an OpenAI-compatible chat endpoint, same shape
 * as the Groq/OpenRouter adapters. mistral-small-latest is the free-tier
 * model; not used for resume/JD content unless the student has explicitly
 * accepted Mistral's free-tier data-training terms, since that tier trains
 * on submitted requests — a real tradeoff for a feature that processes
 * resumes and job descriptions. Wiring it in is the student's own call
 * to make with their own key, not something to default to silently.
 */
export async function callMistral(
  request: AIRequest,
  timeoutMs: number,
  overrideModel?: string,
  overrideApiKey?: string
): Promise<AIResult> {
  const start = Date.now()
  const apiKey = overrideApiKey || process.env.MISTRAL_API_KEY

  if (!apiKey) {
    console.error('[Mistral Provider] No API key available.')
    return { success: false, provider: 'mistral', reason: 'auth_failure', latencyMs: Date.now() - start }
  }

  const modelName = overrideModel || 'mistral-small-latest'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.3,
        ...(request.outputFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('429 rate limit')
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`${response.status} auth failure`)
      }
      const errorText = await response.text().catch(() => 'unknown error')
      throw new Error(`${response.status} ${errorText}`)
    }

    const completion = await response.json()
    const elapsed = Date.now() - start
    const content = completion.choices?.[0]?.message?.content ?? ''
    const usage = completion.usage

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        provider: 'mistral',
        reason: 'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success: true,
      content,
      provider: 'mistral',
      model: modelName,
      tokensUsed: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
        total: usage?.total_tokens ?? 0,
      },
      latencyMs: elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - start
    const isRateLimit = err?.message?.includes('429')
    const isAuth = /\b(401|403)\b/.test(err?.message ?? '')
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout')

    let errorMsg = err instanceof Error ? err.message : String(err)
    errorMsg = errorMsg.replace(/([A-Za-z0-9]{32})/g, (m: string) => (m.length === 32 ? '[REDACTED_API_KEY]' : m))

    let reason: 'rate_limit' | 'timeout' | 'auth_failure' | 'provider_error' = 'provider_error'
    if (isRateLimit) reason = 'rate_limit'
    else if (isAuth) reason = 'auth_failure'
    else if (isTimeout) reason = 'timeout'

    console.error(`[AI Gateway Failure] provider -> mistral -> model -> ${modelName} -> status -> ${err?.status || 'unknown'} -> reason -> ${errorMsg}`)

    return {
      success: false,
      provider: 'mistral',
      reason,
      latencyMs: elapsed,
    }
  }
}
