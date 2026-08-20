/**
 * Which paths Proxy treats as requiring a session.
 *
 * Extracted from `proxy.ts` so it can be unit tested — in particular by a test
 * that walks the `(protected)` route groups on disk and asserts every one of
 * them is listed here. The list had already drifted once: `/interview` and
 * `/notes` were missing (so deep links to them lost their destination on
 * login), and `/submit` pointed at a route that no longer exists.
 *
 * NOTE: this is an *optimistic* check only. Per the Next.js docs, Proxy must
 * never be the sole authorization boundary — each protected route group
 * re-verifies the session in its layout, and that is the real gate. Missing an
 * entry here does not expose data; it degrades the redirect (no `?next=`).
 */
export const PROTECTED_ROUTES = [
  '/ai-search',
  '/assistant',
  '/certifications',
  '/dashboard',
  '/hub',
  '/interview',
  '/notes',
  '/notifications',
  '/opportunities',
  '/profile',
  '/resume',
  '/search',
  '/settings',
  '/support',
  '/tracker',
] as const

/**
 * Paths a signed-in user should be bounced away from.
 *
 * `/forgot-password` is deliberately absent: completing a recovery link signs
 * the user in *before* they reach the "set a new password" step, so listing it
 * here would redirect them to the dashboard and make the password
 * unresettable. `/verify-email` is absent for the same reason — it is reached
 * while signed out, and bouncing it would break the resend flow.
 */
export const AUTH_ROUTES = ['/login', '/signup'] as const

function matches(routes: readonly string[], pathname: string): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

export function isProtectedRoute(pathname: string): boolean {
  return matches(PROTECTED_ROUTES, pathname)
}

export function isAuthRoute(pathname: string): boolean {
  return matches(AUTH_ROUTES, pathname)
}
