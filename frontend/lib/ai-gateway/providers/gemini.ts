import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIRequest, AIResult } from '@/types/ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function callGemini(
  request: AIRequest,
  timeoutMs: number
): Promise<AIResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const model = genAI.getGenerativeModel(
      { model: 'gemini-1.5-flash' },
      { apiVersion: 'v1beta' }
    )

    const fullPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 500,
        temperature:     request.temperature ?? 0.3,
        ...(request.outputFormat === 'json'
          ? { responseMimeType: 'application/json' }
          : {}),
      },
    })

    clearTimeout(timeoutHandle)

    const text    = result.response.text()
    const usage   = result.response.usageMetadata
    const elapsed = Date.now() - start

    if (!text || text.trim().length === 0) {
      return {
        success:   false,
        provider:  'gemini',
        reason:    'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success:  true,
      content:  text,
      provider: 'gemini',
      model:    'gemini-1.5-flash',
      tokensUsed: {
        input:  usage?.promptTokenCount     ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
        total:  usage?.totalTokenCount      ?? 0,
      },
      latencyMs: elapsed,
    }
  } catch (err: unknown) {
    clearTimeout(timeoutHandle)
    const elapsed = Date.now() - start
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout'))

    return {
      success:   false,
      provider:  'gemini',
      reason:    isTimeout ? 'timeout' : 'provider_error',
      latencyMs: elapsed,
    }
  }
}
