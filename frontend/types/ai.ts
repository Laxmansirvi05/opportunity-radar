// ---------------------------------------------------------------------------
// AI Gateway — Core Types (TDD-007)
// ---------------------------------------------------------------------------

export type AIFeature =
  | 'resume_parser'
  | 'resume_ats'
  | 'resume_optimizer'
  | 'skill_extraction'

export type AIProvider = 'gemini' | 'groq'

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------
export interface AIRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number      // Default: 500
  temperature?: number    // Default: 0.3
  outputFormat?: 'text' | 'json'  // 'json' activates Gemini JSON mode
  media?: { data: string; mimeType: string }
}

// ---------------------------------------------------------------------------
// Success response
// ---------------------------------------------------------------------------
export interface AIResponse {
  success: true
  content: string
  provider: AIProvider
  model: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  latencyMs: number
}

// ---------------------------------------------------------------------------
// Failure response
// ---------------------------------------------------------------------------
export type AIFailureReason =
  | 'timeout'
  | 'rate_limit'
  | 'invalid_response'
  | 'provider_error'
  | 'all_failed'

export interface AIError {
  success: false
  provider: AIProvider | 'all'
  reason: AIFailureReason
  latencyMs: number
}

export type AIResult = AIResponse | AIError

// ---------------------------------------------------------------------------
// Gateway call context (for logging)
// ---------------------------------------------------------------------------
export interface GatewayContext {
  feature: AIFeature
  userId?: string
  opportunityId?: string
}

// ---------------------------------------------------------------------------
// Provider adapter interface
// ---------------------------------------------------------------------------
export interface ProviderAdapter {
  call(request: AIRequest): Promise<AIResult>
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------
export function isAIResponse(result: AIResult): result is AIResponse {
  return result.success === true
}

export function isAIError(result: AIResult): result is AIError {
  return result.success === false
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------
export function estimateCostUsd(
  provider: AIProvider,
  tokensInput: number,
  tokensOutput: number
): number {
  if (provider === 'gemini') {
    // Gemini 1.5 Flash pricing
    return tokensInput * 0.000000075 + tokensOutput * 0.0000003
  }
  // Groq free tier
  return 0
}
