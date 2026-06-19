// Re-export all AI types for consumers who import from the lib path
export type {
  AIRequest,
  AIResponse,
  AIError,
  AIResult,
  AIFeature,
  AIProvider,
  AIFailureReason,
  GatewayContext,
  ProviderAdapter,
} from '@/types/ai'

export { isAIResponse, isAIError, estimateCostUsd } from '@/types/ai'
