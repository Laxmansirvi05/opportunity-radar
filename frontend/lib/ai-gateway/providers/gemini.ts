import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIRequest, AIResult } from '@/types/ai'

/**
 * gemini-flash-latest is Google's stable alias for their current
 * recommended Flash model, not a pinned version. Pinning to a specific
 * version like "gemini-2.5-flash" broke silently for newly-created Google
 * Cloud projects — Google stopped granting new projects access to that
 * exact model id ("no longer available to new users", a 404, not a quota
 * error) while still serving it to older/grandfathered projects. The
 * alias sidesteps this: it always resolves to whatever Google currently
 * recommends, for every project cohort, and stays correct as Google
 * rotates model versions in the future.
 */
const DEFAULT_MODEL = 'gemini-flash-latest'
const FALLBACK_MODEL = 'gemini-2.0-flash'

export async function callGemini(
  request: AIRequest,
  timeoutMs: number,
  overrideModel?: string,
  apiKey?: string
): Promise<AIResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) {
    clearTimeout(timeoutHandle)
    console.error('[Gemini Provider] No API key available.')
    return { success: false, provider: 'gemini', reason: 'auth_failure', latencyMs: Date.now() - start }
  }
  const genAI = new GoogleGenerativeAI(key)

  try {
    const tryModel = async (modelName: string) => {
      const targetModel = overrideModel || modelName;
      const model = genAI.getGenerativeModel({ model: targetModel });
      const fullPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: fullPrompt },
            ...(request.media ? [{ inlineData: { data: request.media.data, mimeType: request.media.mimeType } }] : []),
          ],
        }],
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 500,
          temperature:     request.temperature ?? 0.3,
          ...(request.outputFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      });
      return result;
    };

    let result;
    let finalModel = DEFAULT_MODEL;
    try {
      result = await tryModel(DEFAULT_MODEL);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('429')) {
        console.warn(`[Gemini Provider]: ${DEFAULT_MODEL} rate limited. Falling back to ${FALLBACK_MODEL}...`);
        finalModel = FALLBACK_MODEL;
        result = await tryModel(FALLBACK_MODEL);
      } else {
        throw err;
      }
    }

    clearTimeout(timeoutHandle);

    const text    = result.response.text();
    const usage   = result.response.usageMetadata;
    const elapsed = Date.now() - start;

    if (!text || text.trim().length === 0) {
      return {
        success:   false,
        provider:  'gemini',
        reason:    'invalid_response',
        latencyMs: elapsed,
      };
    }

    return {
      success:  true,
      content:  text,
      provider: 'gemini',
      model:    finalModel,
      tokensUsed: {
        input:  usage?.promptTokenCount     ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
        total:  usage?.totalTokenCount      ?? 0,
      },
      latencyMs: elapsed,
    };
  } catch (err: any) {
    clearTimeout(timeoutHandle)
    const elapsed = Date.now() - start
    const isTimeout = err?.name === 'AbortError' || (err instanceof Error && err.message.includes('timeout'))
    const isRateLimit = err?.status === 429 || (err instanceof Error && err.message.includes('429'))
    const isAuth = err?.status === 403 || err?.status === 401 || (err instanceof Error && /\b(403|401)\b/.test(err.message))

    let errorMsg = err instanceof Error ? err.message : String(err)
    // Strip API keys from logs just in case
    errorMsg = errorMsg.replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_API_KEY]')
    errorMsg = errorMsg.replace(/(AQ\.[0-9A-Za-z-_.]{20,})/g, '[REDACTED_API_KEY]')

    const reason = isTimeout ? 'timeout' : (isRateLimit ? 'rate_limit' : (isAuth ? 'auth_failure' : 'provider_error'))

    console.error(`[AI Gateway Failure] provider -> gemini -> model -> ${DEFAULT_MODEL} / ${FALLBACK_MODEL} -> status -> ${err?.status || 'unknown'} -> reason -> ${errorMsg}`)

    return {
      success:   false,
      provider:  'gemini',
      reason,
      latencyMs: elapsed,
    }
  }
}
