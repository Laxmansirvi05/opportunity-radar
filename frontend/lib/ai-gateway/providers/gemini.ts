import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIRequest, AIResult } from '@/types/ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY!)

export async function callGemini(
  request: AIRequest,
  timeoutMs: number,
  overrideModel?: string
): Promise<AIResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

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
    let finalModel = 'gemini-2.5-flash';
    try {
      result = await tryModel('gemini-2.5-flash');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('429')) {
        console.warn('[Gemini Provider]: gemini-2.5-flash rate limited. Falling back to gemini-2.0-flash...');
        finalModel = 'gemini-2.0-flash';
        result = await tryModel('gemini-2.0-flash');
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
    
    let errorMsg = err instanceof Error ? err.message : String(err)
    // Strip API keys from logs just in case
    errorMsg = errorMsg.replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_API_KEY]')
    
    const reason = isTimeout ? 'timeout' : (isRateLimit ? 'rate_limit' : 'provider_error')
    
    console.error(`[AI Gateway Failure] provider -> gemini -> model -> gemini-2.5-flash / gemini-2.0-flash -> status -> ${err?.status || 'unknown'} -> reason -> ${errorMsg}`)
    
    return {
      success:   false,
      provider:  'gemini',
      reason,
      latencyMs: elapsed,
    }
  }
}
