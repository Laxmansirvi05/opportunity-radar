import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  PROTECTED_ROUTES,
  AUTH_ROUTES,
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
    for (const route of ['/', '/login', '/privacy', '/terms', '/notes/shared/abc']) {
      expect(isProtectedRoute(route)).toBe(route === '/notes/shared/abc')
    }
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
