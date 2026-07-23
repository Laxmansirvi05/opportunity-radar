import type { AIRequest, AIResult } from '@/types/ai'

export async function callOpenRouter(
  request: AIRequest,
  timeoutMs: number
): Promise<AIResult> {
  const start = Date.now()
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    console.error('[OpenRouter Provider] Missing OPENROUTER_API_KEY environment variable.')
    return {
      success: false,
      provider: 'openrouter',
      reason: 'provider_error',
      latencyMs: Date.now() - start,
    }
  }

  // Model choice: google/gemini-2.5-flash is often free or very low cost on openrouter, or meta-llama/llama-3.1-8b-instruct:free
  // For structured resume extraction, we'll try meta-llama/llama-3.3-70b-instruct:free or similar good free model.
  // Wait, let's use a solid model like "google/gemini-2.5-flash" on openrouter, or "meta-llama/llama-3.1-8b-instruct"
  // The user requests "prefer a free/low-cost model during development, but do not hardcode a model that has been verified as unavailable."
  // "google/gemini-2.5-flash" via OpenRouter is cheap and works well.
  const modelName = 'google/gemini-2.5-flash' 

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        max_tokens: request.maxTokens ?? 1500, // Make sure we have enough tokens for extraction
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
        provider: 'openrouter',
        reason: 'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success: true,
      content,
      provider: 'openrouter',
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
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout')

    let errorMsg = err instanceof Error ? err.message : String(err)
    // Strip API keys from logs just in case (sk-or-v1-...)
    errorMsg = errorMsg.replace(/(sk-or-v1-[A-Za-z0-9]{40,})/g, '[REDACTED_API_KEY]')

    let reason: 'rate_limit' | 'timeout' | 'provider_error' = 'provider_error'
    if (isRateLimit) reason = 'rate_limit'
    if (isTimeout) reason = 'timeout'

    console.error(`[AI Gateway Failure] provider -> openrouter -> model -> ${modelName} -> status -> ${err?.status || 'unknown'} -> reason -> ${errorMsg}`)

    return {
      success: false,
      provider: 'openrouter',
      reason,
      latencyMs: elapsed,
    }
  }
}
