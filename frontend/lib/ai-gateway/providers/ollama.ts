import type { AIRequest, AIResult } from '@/types/ai'

export async function callOllama(
  request: AIRequest,
  timeoutMs: number,
  modelName: string
): Promise<AIResult> {
  const start = Date.now()
  const apiKey = process.env.OLLAMA_API_KEY

  if (!apiKey) {
    console.error('[Ollama Provider] Missing OLLAMA_API_KEY')
    return {
      success: false,
      provider: 'ollama',
      reason: 'auth_failure',
      latencyMs: Date.now() - start,
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const url = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com/api/chat'

    const response = await fetch(url, {
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
        stream: false,
        format: request.outputFormat === 'json' ? 'json' : undefined,
        options: {
          temperature: request.temperature ?? 0.3,
          num_predict: request.maxTokens ?? 1500,
          num_ctx: 32768,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('429 rate limit')
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('401 auth failure')
      }
      const errorText = await response.text().catch(() => 'unknown error')
      throw new Error(`${response.status} ${errorText}`)
    }

    const json = await response.json()
    const elapsed = Date.now() - start
    const content = json.message?.content ?? ''

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        provider: 'ollama',
        reason: 'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success: true,
      content,
      provider: 'ollama',
      model: modelName,
      tokensUsed: {
        input: json.prompt_eval_count ?? 0,
        output: json.eval_count ?? 0,
        total: (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0),
      },
      latencyMs: elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - start
    const isRateLimit = err?.message?.includes('429')
    const isAuth = err?.message?.includes('401')
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout')

    let errorMsg = err instanceof Error ? err.message : String(err)
    // Redact tokens just in case
    errorMsg = errorMsg.replace(/Bearer [A-Za-z0-9_.-]+/g, 'Bearer [REDACTED]')

    let reason: 'rate_limit' | 'timeout' | 'auth_failure' | 'provider_error' = 'provider_error'
    if (isRateLimit) reason = 'rate_limit'
    else if (isAuth) reason = 'auth_failure'
    else if (isTimeout) reason = 'timeout'

    console.error(`[Ollama Provider Failure] -> status -> unknown -> reason -> ${errorMsg}`)

    return {
      success: false,
      provider: 'ollama',
      reason,
      latencyMs: elapsed,
    }
  }
}
