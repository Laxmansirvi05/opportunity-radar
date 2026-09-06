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

/**
 * Public paths that sit underneath a protected prefix.
 *
 * `matches()` below is prefix-based, so a listed route also claims everything
 * nested under it. That is what makes `/opportunities/<id>` protected without
 * enumerating ids — and it is also how `/notes` came to claim
 * `/notes/shared/<slug>`, the read-only page behind "anyone with the link can
 * view". That page lives outside every protected route group and documents
 * itself as deliberately unauthenticated, but Proxy was redirecting anonymous
 * visitors to `/login?next=…`, so share links worked for exactly the audience
 * that did not need them and failed for everyone they were meant for.
 *
 * Checked before the protected list, and matched as a prefix so the `[slug]`
 * segment is covered.
 */
export const PUBLIC_ROUTE_EXCEPTIONS = ['/notes/shared'] as const

function matches(routes: readonly string[], pathname: string): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

export function isProtectedRoute(pathname: string): boolean {
  if (matches(PUBLIC_ROUTE_EXCEPTIONS, pathname)) return false
  return matches(PROTECTED_ROUTES, pathname)
}

export function isAuthRoute(pathname: string): boolean {
  return matches(AUTH_ROUTES, pathname)
}
