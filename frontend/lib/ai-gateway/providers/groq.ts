import Groq from 'groq-sdk'
import type { AIRequest, AIResult } from '@/types/ai'

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function callGroq(
  request: AIRequest,
  timeoutMs: number
): Promise<AIResult> {
  const start = Date.now()

  try {
    const completion = await groqClient.chat.completions.create(
      {
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user',   content: request.userPrompt },
        ],
        max_tokens:  request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.3,
        ...(request.outputFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      },
      { timeout: timeoutMs }
    )

    const elapsed = Date.now() - start
    const content = completion.choices[0]?.message?.content ?? ''
    const usage   = completion.usage

    if (!content || content.trim().length === 0) {
      return {
        success:   false,
        provider:  'groq',
        reason:    'invalid_response',
        latencyMs: elapsed,
      }
    }

    return {
      success:  true,
      content,
      provider: 'groq',
      model:    'llama3-8b-8192',
      tokensUsed: {
        input:  usage?.prompt_tokens     ?? 0,
        output: usage?.completion_tokens ?? 0,
        total:  usage?.total_tokens      ?? 0,
      },
      latencyMs: elapsed,
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - start
    return {
      success:   false,
      provider:  'groq',
      reason:    'provider_error',
      latencyMs: elapsed,
    }
  }
}
