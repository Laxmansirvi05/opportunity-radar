import type { AIProvider, AIFailureReason } from '@/types/ai'

export interface ProviderHealthState {
  lastFailureTime: number
  failureReason: AIFailureReason
  retryAfterTime: number
  consecutiveFailures: number
}

// In-memory state: key = `${provider}:${model}`
const healthStore = new Map<string, ProviderHealthState>()

const DEFAULT_BACKOFF_MS = {
  rate_limit: 60_000,      // 1 minute
  auth_failure: 300_000,   // 5 minutes
  timeout: 15_000,         // 15 seconds
  server_error: 30_000,    // 30 seconds
  context_limit: 60_000,   // 1 minute
  schema_failure: 10_000,  // 10 seconds (maybe transient generation bug)
  provider_error: 15_000,
  invalid_response: 10_000,
  all_failed: 0,
}

/**
 * Get a cache key for provider + model + (optionally) which specific key.
 *
 * The keyId component matters once a provider has more than one API key:
 * a rate limit on key #1 must not block key #2 of the same provider/model
 * from being tried — they are independent quotas. Omitting keyId keeps the
 * old provider+model-only behaviour for single-key providers.
 */
function getKey(provider: AIProvider, model: string, keyId?: string): string {
  return keyId ? `${provider}:${model}:${keyId}` : `${provider}:${model}`
}

/**
 * Check if a specific provider + model (+ key) is currently healthy and allowed to be called.
 */
export function isProviderHealthy(provider: AIProvider, model: string, keyId?: string): boolean {
  const key = getKey(provider, model, keyId)
  const state = healthStore.get(key)

  if (!state) return true

  const now = Date.now()
  return now >= state.retryAfterTime
}

/**
 * Record a failure for a specific provider + model (+ key).
 * Optional retryAfterMs to override the default backoff.
 */
export function recordProviderFailure(
  provider: AIProvider,
  model: string,
  reason: AIFailureReason,
  retryAfterMs?: number,
  keyId?: string
): void {
  const key = getKey(provider, model, keyId)
  const now = Date.now()
  const existing = healthStore.get(key)
  
  const consecutiveFailures = existing ? existing.consecutiveFailures + 1 : 1
  
  // Calculate backoff
  let backoff = retryAfterMs !== undefined ? retryAfterMs : (DEFAULT_BACKOFF_MS[reason] || 15_000)
  
  // Exponential backoff up to 5 minutes, unless specified explicitly
  if (retryAfterMs === undefined) {
    backoff = Math.min(backoff * Math.pow(1.5, consecutiveFailures - 1), 300_000)
  }
  
  healthStore.set(key, {
    lastFailureTime: now,
    failureReason: reason,
    retryAfterTime: now + backoff,
    consecutiveFailures
  })
}

/**
 * Record a success, resetting the failure count.
 */
export function recordProviderSuccess(provider: AIProvider, model: string, keyId?: string): void {
  const key = getKey(provider, model, keyId)
  healthStore.delete(key)
}

/**
 * Reset all health states (useful for testing)
 */
export function resetProviderHealth(): void {
  healthStore.clear()
}
