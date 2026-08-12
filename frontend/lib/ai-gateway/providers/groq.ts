import Groq from 'groq-sdk'
import type { AIRequest, AIResult } from '@/types/ai'

// One client per API key, not one global singleton — different demo/backup
// keys must not share a client instance (the SDK bakes the key in at
// construction time).
const clientCache = new Map<string, Groq>()
function getGroqClient(apiKey: string): Groq {
  let client = clientCache.get(apiKey)
  if (!client) {
    client = new Groq({ apiKey })
    clientCache.set(apiKey, client)
  }
  return client
}

export async function callGroq(
  request: AIRequest,
  timeoutMs: number,
  overrideModel?: string,
  apiKey?: string
): Promise<AIResult> {
  const start = Date.now()
  const key = apiKey || process.env.GROQ_API_KEY
  if (!key) {
    console.error('[Groq Provider] No API key available.')
    return { success: false, provider: 'groq', reason: 'auth_failure', latencyMs: Date.now() - start }
  }

  try {
    const tryModel = async (modelName: string) => {
      const targetModel = overrideModel || modelName;
      return await getGroqClient(key).chat.completions.create(
        {
          model: targetModel,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          max_tokens: request.maxTokens ?? 500,
          temperature: request.temperature ?? 0.3,
          ...(request.outputFormat === 'json'
            ? { response_format: { type: 'json_object' } }
            : {}),
        },
        { timeout: timeoutMs }
      )
    };

    let completion;
    let finalModel = 'llama-3.3-70b-versatile';

    try {
      completion = await tryModel('llama-3.3-70b-versatile');
    } catch (err: any) {
      if (err?.status === 429 || (err instanceof Error && err.message.includes('429'))) {
        console.warn('[Groq Provider]: llama-3.3-70b-versatile rate limited. Falling back to llama-3.1-8b-instant...');
        finalModel = 'llama-3.1-8b-instant';
        completion = await tryModel('llama-3.1-8b-instant');
      } else {
        throw err;
      }
    }

    const elapsed = Date.now() - start
    const content = completion.choices[0]?.message?.content ?? ''
    const usage = completion.usage

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        provider: 'groq',
        reason: 'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success: true,
      content,
      provider: 'groq',
      model: finalModel,
      tokensUsed: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
        total: usage?.total_tokens ?? 0,
      },
      latencyMs: elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - start
    const isRateLimit = err?.status === 429 || (err instanceof Error && err.message.includes('429'));
    const isAuth = err?.status === 401 || err?.status === 403

    let errorMsg = err instanceof Error ? err.message : String(err)
    // Strip API keys from logs just in case (gsk_...)
    errorMsg = errorMsg.replace(/(gsk_[A-Za-z0-9]{40,})/g, '[REDACTED_API_KEY]')

    const reason = isRateLimit ? 'rate_limit' : (isAuth ? 'auth_failure' : 'provider_error')

    console.error(`[AI Gateway Failure] provider -> groq -> model -> llama-3.3-70b-versatile / llama-3.1-8b-instant -> status -> ${err?.status || 'unknown'} -> reason -> ${errorMsg}`)

    return {
      success: false,
      provider: 'groq',
      reason,
      latencyMs: elapsed,
    }
  }
}
