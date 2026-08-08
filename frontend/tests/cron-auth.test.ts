import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { denyIfNotCron } from '@/lib/cron-auth'

/**
 * Regression cover for audit item A3.
 *
 * Every /api/cron/* route used to check:
 *   authHeader !== `Bearer ${process.env.CRON_SECRET}`
 *
 * With CRON_SECRET unset, that template evaluates to the literal string
 * "Bearer undefined" — so sending exactly that header authenticated you.
 * These tests pin the fail-closed behaviour that replaced it.
 */

function req(authorization?: string): Request {
  return new Request('https://example.com/api/cron/refresh-providers', {
    headers: authorization ? { authorization } : {},
  })
}

describe('denyIfNotCron', () => {
  beforeEach(() => vi.unstubAllEnvs())
  afterEach(() => vi.unstubAllEnvs())

  describe('when CRON_SECRET is not configured', () => {
    it('refuses the exact "Bearer undefined" exploit that used to work', async () => {
      vi.stubEnv('CRON_SECRET', '')

      const denied = denyIfNotCron(req('Bearer undefined'))

      expect(denied).not.toBeNull()
      expect(denied!.status).toBe(503)
    })

    it('refuses every request, even one with no header at all', () => {
      vi.stubEnv('CRON_SECRET', '')
      expect(denyIfNotCron(req())?.status).toBe(503)
    })

    it('treats a whitespace-only secret as unconfigured', () => {
      vi.stubEnv('CRON_SECRET', '   ')
      expect(denyIfNotCron(req('Bearer    '))?.status).toBe(503)
    })

    it('reports 503 (misconfigured) rather than 401, so the cause is obvious', async () => {
      vi.stubEnv('CRON_SECRET', '')
      const denied = denyIfNotCron(req('Bearer anything'))
      expect(denied!.status).toBe(503)
      expect(await denied!.text()).toContain('not configured')
    })
  })

  describe('when CRON_SECRET is configured', () => {
    const SECRET = '7a3674b7758a3d2fd8b40e9d1703e0f2839369a4e17e468fae4c0989d4d824b8'

    beforeEach(() => vi.stubEnv('CRON_SECRET', SECRET))

    it('allows the correct Bearer token', () => {
      expect(denyIfNotCron(req(`Bearer ${SECRET}`))).toBeNull()
    })

    it('rejects a missing header', () => {
      expect(denyIfNotCron(req())?.status).toBe(401)
    })

    it('rejects a wrong secret', () => {
      expect(denyIfNotCron(req('Bearer wrong-secret'))?.status).toBe(401)
    })

    it('rejects "Bearer undefined" now that a real secret exists', () => {
      expect(denyIfNotCron(req('Bearer undefined'))?.status).toBe(401)
    })

    it('rejects the bare secret without the Bearer prefix', () => {
      expect(denyIfNotCron(req(SECRET))?.status).toBe(401)
    })

    it('rejects a correct prefix of the secret (no partial matches)', () => {
      expect(denyIfNotCron(req(`Bearer ${SECRET.slice(0, -1)}`))?.status).toBe(401)
    })

    it('accepts a token with surrounding whitespace, because HTTP strips it', () => {
      // The Headers API trims header values per the HTTP spec, so this arrives
      // at the handler byte-identical to the clean token. Asserting a rejection
      // here would be testing a condition that can never reach us.
      expect(denyIfNotCron(req(`Bearer ${SECRET} `))).toBeNull()
    })

    it('rejects internal whitespace, which HTTP does not strip', () => {
      expect(denyIfNotCron(req(`Bearer ${SECRET.slice(0, 8)} ${SECRET.slice(8)}`))?.status).toBe(401)
    })

    it('is case-sensitive on the token', () => {
      expect(denyIfNotCron(req(`Bearer ${SECRET.toUpperCase()}`))?.status).toBe(401)
    })
  })
})
