import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves normally when the request completes before the timeout', async () => {
    const response = new Response('ok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const result = await fetchWithTimeout('/api/test', {}, 5000)
    expect(result).toBe(response)
  })

  it('throws a clear, bounded-wait message when the request exceeds the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }))

    const promise = fetchWithTimeout('/api/slow', {}, 1000)
    const assertion = expect(promise).rejects.toThrow(/taking longer than expected/i)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('re-throws a non-abort error unchanged', async () => {
    const networkError = new Error('network down')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    await expect(fetchWithTimeout('/api/test', {}, 5000)).rejects.toThrow('network down')
  })
})
