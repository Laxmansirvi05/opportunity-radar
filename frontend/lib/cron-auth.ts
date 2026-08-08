import { timingSafeEqual } from 'node:crypto'

/**
 * Shared authorisation guard for every /api/cron/* route.
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when it
 * invokes a cron job, provided CRON_SECRET is set on the project.
 *
 * The previous per-route check was `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``.
 * When CRON_SECRET was unset that template produced the literal string
 * "Bearer undefined", so anyone sending that exact header authenticated
 * successfully. This helper fails closed instead: no secret configured means
 * nobody gets in, and the misconfiguration is logged loudly.
 */

export type CronAuthFailure = Response

/** Constant-time string comparison, so the secret can't be recovered by timing. */
function secureEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on length mismatch, and length alone is not secret.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Returns `null` when the request is a legitimate cron invocation, or a
 * ready-to-return Response when it is not.
 *
 * Usage:
 *   const denied = denyIfNotCron(request)
 *   if (denied) return denied
 */
export function denyIfNotCron(request: Request): CronAuthFailure | null {
  const cronSecret = process.env.CRON_SECRET

  // Fail closed on misconfiguration — never fall back to comparing against
  // "Bearer undefined".
  if (!cronSecret || cronSecret.trim().length === 0) {
    console.error(
      '[Cron] REFUSED — CRON_SECRET is not set on this deployment. ' +
        'Set it in the Vercel project (Production) so Vercel can authenticate its cron invocations.'
    )
    return new Response('Cron is not configured on this deployment.', { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !secureEquals(authHeader, `Bearer ${cronSecret}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}
