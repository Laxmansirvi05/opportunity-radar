import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

/**
 * The auth helper functions are SECURITY DEFINER and reachable through
 * PostgREST. Granting them to `anon` let anyone with the public key lock an
 * account out (log_login_attempt) or probe which emails have accounts
 * (check_user_confirmed, login_hint_for_email). They must stay server-only.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations')
const ACTIONS = path.resolve(__dirname, '../features/auth/actions/auth-actions.ts')

const HELPERS = [
  'log_login_attempt',
  'check_login_rate_limit',
  'log_email_resend',
  'check_email_resend_cooldown',
  'check_user_confirmed',
  'login_hint_for_email',
]

describe('auth helper functions are server-only', () => {
  const lockdown = readFileSync(
    path.join(MIGRATIONS_DIR, '20261009120000_auth_helpers_service_role_only.sql'),
    'utf8'
  )

  it.each(HELPERS)('%s is revoked from the public roles', (fn) => {
    expect(lockdown).toContain(`public.${fn}(`)
    expect(lockdown).toMatch(/revoke execute on function %s from public, anon, authenticated/)
  })

  it('no later migration grants a helper back to anon or authenticated', () => {
    const later = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{14}_/.test(f) && f > '20261009120000')
      .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
      .join('\n')
    for (const fn of HELPERS) {
      const regrant = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[^;]*\\bto\\b[^;]*(anon|authenticated)`, 'i')
      expect(later).not.toMatch(regrant)
    }
  })

  it('the server actions never call a helper with the user-scoped client', () => {
    const src = readFileSync(ACTIONS, 'utf8')
    for (const fn of HELPERS) {
      expect(src).not.toMatch(new RegExp(`supabase\\.rpc\\(\\s*['"]${fn}['"]`))
      expect(src).toMatch(new RegExp(`admin\\.rpc\\(\\s*['"]${fn}['"]`))
    }
  })
})
