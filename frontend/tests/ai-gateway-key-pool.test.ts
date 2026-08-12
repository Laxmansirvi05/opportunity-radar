import { describe, it, expect, afterEach } from 'vitest'
import { getProviderApiKeys, keyFingerprint } from '@/lib/ai-gateway/key-pool'

const ENV_KEYS = [
  'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4',
  'GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4',
  'OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3', 'OPENROUTER_API_KEY_4',
  'OLLAMA_API_KEY', 'OLLAMA_API_KEY_2',
  'CLOUDFLARE_API_TOKEN',
  'MISTRAL_API_KEY',
]

function clearProviderEnv() {
  for (const k of ENV_KEYS) delete process.env[k]
}

describe('AI Gateway key pool', () => {
  afterEach(() => {
    clearProviderEnv()
  })

  it('returns an empty list when no keys are configured', () => {
    clearProviderEnv()
    expect(getProviderApiKeys('groq')).toEqual([])
  })

  it('collects every numbered key for a provider, primary first', () => {
    clearProviderEnv()
    process.env.GROQ_API_KEY = 'key-a'
    process.env.GROQ_API_KEY_2 = 'key-b'
    process.env.GROQ_API_KEY_3 = 'key-c'
    expect(getProviderApiKeys('groq')).toEqual(['key-a', 'key-b', 'key-c'])
  })

  it('skips gaps — a missing GROQ_API_KEY_2 does not stop _3 from being picked up', () => {
    clearProviderEnv()
    process.env.GROQ_API_KEY = 'key-a'
    process.env.GROQ_API_KEY_3 = 'key-c'
    expect(getProviderApiKeys('groq')).toEqual(['key-a', 'key-c'])
  })

  it('collapses duplicate values instead of trying the identical key twice', () => {
    clearProviderEnv()
    process.env.GROQ_API_KEY = 'same-key'
    process.env.GROQ_API_KEY_2 = 'same-key'
    process.env.GROQ_API_KEY_3 = 'different-key'
    expect(getProviderApiKeys('groq')).toEqual(['same-key', 'different-key'])
  })

  it('gemini treats GOOGLE_GENERATIVE_AI_API_KEY and GEMINI_API_KEY as equally-valid primary slots', () => {
    clearProviderEnv()
    process.env.GEMINI_API_KEY = 'legacy-name'
    process.env.GEMINI_API_KEY_2 = 'second-key'
    expect(getProviderApiKeys('gemini')).toEqual(['legacy-name', 'second-key'])
  })

  it('a provider with only one numbered slot (ollama) still works', () => {
    clearProviderEnv()
    process.env.OLLAMA_API_KEY = 'only-key'
    process.env.OLLAMA_API_KEY_2 = 'backup-key'
    expect(getProviderApiKeys('ollama')).toEqual(['only-key', 'backup-key'])
  })

  it('a provider with no rotation support (cloudflare) returns at most its one key', () => {
    clearProviderEnv()
    process.env.CLOUDFLARE_API_TOKEN = 'the-token'
    expect(getProviderApiKeys('cloudflare')).toEqual(['the-token'])
  })
})

describe('keyFingerprint', () => {
  it('returns the last 4 characters', () => {
    expect(keyFingerprint('gsk_abcdefgh1234')).toBe('1234')
  })

  it('never returns the full key, even for a short one', () => {
    const short = 'ab'
    expect(keyFingerprint(short)).not.toBe(short)
  })
})
