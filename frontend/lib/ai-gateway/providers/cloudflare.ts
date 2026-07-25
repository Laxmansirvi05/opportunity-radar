import type { AIRequest, AIResult } from '@/types/ai'

export async function callCloudflare(
  request: AIRequest,
  timeoutMs: number,
  modelName: string = '@cf/meta/llama-3.1-8b-instruct'
): Promise<AIResult> {
  const start = Date.now()
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    console.error('[Cloudflare Provider] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN')
    return {
      success: false,
      provider: 'cloudflare',
      reason: 'auth_failure',
      latencyMs: Date.now() - start,
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Using the Cloudflare REST API for Workers AI
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelName}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens ?? 1500,
        temperature: request.temperature ?? 0.3,
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
    
    if (!json.success) {
      throw new Error(`Cloudflare API returned success: false. Errors: ${JSON.stringify(json.errors)}`)
    }

    const rawRes = json.result?.response ?? json.result?.choices?.[0]?.message?.content ?? ''
    const content = typeof rawRes === 'string' ? rawRes : String(rawRes || '')

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        provider: 'cloudflare',
        reason: 'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success: true,
      content,
      provider: 'cloudflare',
      model: modelName,
      tokensUsed: {
        // Cloudflare might not return tokens usage strictly in the same format depending on the model/endpoint
        input: 0,
        output: 0,
        total: 0,
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
    errorMsg = errorMsg.replace(/(cfut_[A-Za-z0-9_-]{30,})/g, '[REDACTED_API_TOKEN]')

    let reason: 'rate_limit' | 'timeout' | 'auth_failure' | 'provider_error' = 'provider_error'
    if (isRateLimit) reason = 'rate_limit'
    else if (isAuth) reason = 'auth_failure'
    else if (isTimeout) reason = 'timeout'

    console.error(`[Cloudflare Provider Failure] -> status -> unknown -> reason -> ${errorMsg}`)

    return {
      success: false,
      provider: 'cloudflare',
      reason,
      latencyMs: elapsed,
    }
  }
}
