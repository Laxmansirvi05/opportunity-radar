import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  PROTECTED_ROUTES,
  AUTH_ROUTES,
  PUBLIC_ROUTE_EXCEPTIONS,
  isProtectedRoute,
  isAuthRoute,
} from '@/lib/auth/protected-routes'

const APP_DIR = path.resolve(__dirname, '../app')

/** Top-level route segments inside a Next.js route group, ignoring private dirs. */
function routeSegments(group: string): string[] {
  const dir = path.join(APP_DIR, group)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Route groups `(x)`, private folders `_x`, and dynamic segments `[x]`
    // are not addressable top-level paths of their own.
    .filter((name) => !name.startsWith('(') && !name.startsWith('_') && !name.startsWith('['))
}

describe('protected route coverage', () => {
  /**
   * The regression this exists for: `/interview` and `/notes` were missing
   * from the list, so a signed-out deep link to them was redirected by the
   * layout with no `?next=` and the user landed on the dashboard instead of
   * where they were going. Adding a route group directory without listing it
   * here now fails the suite rather than quietly degrading the redirect.
   */
  it('covers every directory in the protected route groups', () => {
    const routes = [
      ...routeSegments('(protected)'),
      ...routeSegments('(protected-fullscreen)'),
    ]

    // Sanity check that the walk found anything at all — an empty list would
    // make this test vacuously pass if the directory layout ever moves.
    expect(routes.length).toBeGreaterThan(10)

    const unprotected = routes.filter((route) => !isProtectedRoute(`/${route}`))
    expect(unprotected).toEqual([])
  })

  it('lists no route that no longer exists', () => {
    // `/submit` sat in this list pointing at a route that had been removed.
    const existing = new Set([
      ...routeSegments('(protected)'),
      ...routeSegments('(protected-fullscreen)'),
    ])
    const stale = PROTECTED_ROUTES.filter((route) => !existing.has(route.replace(/^\//, '')))
    expect(stale).toEqual([])
  })

  /**
   * Each exception punches a hole in a protected prefix, so a stale one is a
   * hole with nothing behind it. The page must exist, and it must live outside
   * the protected route groups — a page inside `(protected)` re-verifies the
   * session in its layout, so excepting it here would only strip the `?next=`
   * from the redirect while still requiring a login.
   */
  it('excepts only public pages that exist on disk', () => {
    for (const route of PUBLIC_ROUTE_EXCEPTIONS) {
      expect(existsSync(path.join(APP_DIR, route))).toBe(true)
      expect(existsSync(path.join(APP_DIR, '(protected)', route))).toBe(false)
      expect(existsSync(path.join(APP_DIR, '(protected-fullscreen)', route))).toBe(false)
    }
  })
})

describe('isProtectedRoute', () => {
  it('matches a listed route exactly', () => {
    expect(isProtectedRoute('/dashboard')).toBe(true)
  })

  it('matches nested paths under a listed route', () => {
    expect(isProtectedRoute('/interview/history')).toBe(true)
    expect(isProtectedRoute('/opportunities/abc-123')).toBe(true)
  })

  it('does not match public routes', () => {
    for (const route of ['/', '/login', '/privacy', '/terms']) {
      expect(isProtectedRoute(route)).toBe(false)
    }
  })

  /**
   * `/notes/shared/<slug>` is the read-only page behind "anyone with the link
   * can view". It lives outside every protected route group and documents itself
   * as deliberately unauthenticated, but the `/notes` entry claimed it by prefix
   * and Proxy bounced anonymous visitors to `/login?next=…` — so share links
   * worked only for people who were already signed in, which is the one audience
   * that does not need them.
   *
   * This assertion previously read `expect(isProtectedRoute(route)).toBe(route
   * === '/notes/shared/abc')`, pinning the bug in place as if it were intended.
   */
  it('does not protect the public shared-note page', () => {
    expect(isProtectedRoute('/notes/shared/abc')).toBe(false)
    expect(isProtectedRoute('/notes/shared')).toBe(false)
  })

  it('still protects the owner-facing notes routes', () => {
    expect(isProtectedRoute('/notes')).toBe(true)
    expect(isProtectedRoute('/notes/some-note-id')).toBe(true)
    // Only the `/notes/shared` prefix is excepted, not anything merely
    // resembling it.
    expect(isProtectedRoute('/notes/sharedagain')).toBe(true)
    expect(isProtectedRoute('/notes/shared-drafts')).toBe(true)
  })

  it('does not match a route that merely shares a prefix', () => {
    // `/searchable` must not be caught by the `/search` entry.
    expect(isProtectedRoute('/searchable')).toBe(false)
    expect(isProtectedRoute('/hubbub')).toBe(false)
  })
})

describe('isAuthRoute', () => {
  it('matches the login and signup screens', () => {
    expect(isAuthRoute('/login')).toBe(true)
    expect(isAuthRoute('/signup')).toBe(true)
  })

  /**
   * Both of these are reached mid-flow and must NOT bounce to the dashboard:
   * completing a recovery link signs the user in before they set the new
   * password, so redirecting /forgot-password would make it unresettable.
   */
  it('does not match the recovery or verification screens', () => {
    expect(isAuthRoute('/forgot-password')).toBe(false)
    expect(isAuthRoute('/verify-email')).toBe(false)
  })

  it('never overlaps with the protected list', () => {
    const overlap = AUTH_ROUTES.filter((route) => isProtectedRoute(route))
    expect(overlap).toEqual([])
  })
})
