import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * The Supabase session cookie must stay readable by browser JavaScript.
 *
 * @supabase/ssr's createBrowserClient() reads the session from
 * document.cookie. An "auth hardening" change once set `httpOnly: true` on
 * these cookies; every client component then saw a signed-in user as signed
 * out (bookmarks, profile, settings, avatar upload, password reset, Hub
 * realtime). Nothing failed at build or in unit tests, so this guards the
 * two places the cookies are written.
 */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('Supabase session cookies are not httpOnly', () => {
  it.each(['lib/supabase/server.ts', 'proxy.ts', 'app/auth/callback/route.ts'])('%s', (file) => {
    const code = strip(readFileSync(path.resolve(__dirname, '..', file), 'utf8'))
    expect(code).not.toMatch(/httpOnly\s*:\s*true/)
  })
})
