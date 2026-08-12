import type { AIProvider } from '@/types/ai'

/**
 * Every env var name that can hold a key for a given provider, primary
 * first. A provider with several student-supplied keys (for demo-day
 * resilience — one account's free-tier limit shouldn't stall a live
 * demo) rotates through all of them before the gateway falls through to
 * the next provider in the sequence. Gemini keeps its original two names
 * (GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY) as equally-valid primary
 * slots for backward compatibility — whichever is set is tried first.
 */
const KEY_ENV_VARS: Record<AIProvider, string[]> = {
  gemini: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4'],
  groq: ['GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4'],
  openrouter: ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3', 'OPENROUTER_API_KEY_4'],
  ollama: ['OLLAMA_API_KEY', 'OLLAMA_API_KEY_2'],
  cloudflare: ['CLOUDFLARE_API_TOKEN'],
  mistral: ['MISTRAL_API_KEY'],
}

/**
 * Every configured key for a provider, in priority order, with duplicate
 * values collapsed to one entry — two env var names accidentally holding
 * the identical key (e.g. a copy-paste) must not be tried twice in a row.
 */
export function getProviderApiKeys(provider: AIProvider): string[] {
  const vars = KEY_ENV_VARS[provider] ?? []
  const seen = new Set<string>()
  const keys: string[] = []
  for (const name of vars) {
    const value = process.env[name]
    if (value && !seen.has(value)) {
      seen.add(value)
      keys.push(value)
    }
  }
  return keys
}

/**
 * Last 4 characters only — enough to tell keys apart in logs and as a
 * per-key health-tracking identifier, never enough to reconstruct the key.
 */
export function keyFingerprint(key: string): string {
  return key.length > 4 ? key.slice(-4) : 'xxxx'
}
