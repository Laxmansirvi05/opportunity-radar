import { describe, it, expect } from 'vitest'
import {
  validateSignupInput,
  validateLoginInput,
  MIN_PASSWORD_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
} from '@/lib/auth/credentials'

/**
 * The signup/login forms are server actions — plain endpoints that can be
 * called without the form, so `required` and `minLength` in the markup are not
 * the enforcement point. These are.
 */
describe('validateSignupInput', () => {
  const valid = { email: 'Aarav@Example.com', password: 'hunter22', name: '  Aarav Sharma ' }

  it('accepts a well-formed signup', () => {
    const result = validateSignupInput(valid)
    expect(result.ok).toBe(true)
  })

  it('normalises the email and trims the name', () => {
    const result = validateSignupInput(valid)
    if (!result.ok) throw new Error('expected valid input')
    expect(result.value.email).toBe('aarav@example.com')
    expect(result.value.name).toBe('Aarav Sharma')
  })

  it('never trims the password — whitespace can be part of it', () => {
    const result = validateSignupInput({ ...valid, password: '  spaced  ' })
    if (!result.ok) throw new Error('expected valid input')
    expect(result.value.password).toBe('  spaced  ')
  })

  it('rejects a name that is only whitespace', () => {
    const result = validateSignupInput({ ...valid, name: '   ' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects missing or non-string fields', () => {
    expect(validateSignupInput({ email: null, password: 'hunter22', name: 'A' }).ok).toBe(false)
    expect(validateSignupInput({ email: 'a@b.co', password: undefined, name: 'A' }).ok).toBe(false)
    expect(validateSignupInput({ email: 'a@b.co', password: 'hunter22', name: 42 }).ok).toBe(false)
  })

  it('rejects malformed email addresses', () => {
    for (const email of ['notanemail', 'no@domain', 'no domain@x.com', '@example.com', 'a@b@c.com']) {
      expect(validateSignupInput({ ...valid, email }).ok).toBe(false)
    }
  })

  it(`rejects passwords under ${MIN_PASSWORD_LENGTH} characters`, () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const result = validateSignupInput({ ...valid, password: short })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected invalid input')
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH))
  })

  it('accepts a password exactly at the minimum', () => {
    expect(validateSignupInput({ ...valid, password: 'a'.repeat(MIN_PASSWORD_LENGTH) }).ok).toBe(true)
  })

  it('rejects unbounded email and name input', () => {
    const longLocal = 'a'.repeat(MAX_EMAIL_LENGTH) + '@example.com'
    expect(validateSignupInput({ ...valid, email: longLocal }).ok).toBe(false)
    expect(validateSignupInput({ ...valid, name: 'n'.repeat(MAX_NAME_LENGTH + 1) }).ok).toBe(false)
  })
})

describe('validateLoginInput', () => {
  it('accepts any non-empty pair and normalises the email', () => {
    const result = validateLoginInput({ email: ' USER@Example.com ', password: 'x' })
    if (!result.ok) throw new Error('expected valid input')
    expect(result.value.email).toBe('user@example.com')
  })

  /**
   * Login must not apply the signup password rules: the rules can change after
   * an account is created, and "too short" on a login form leaks a fact about
   * the stored credential.
   */
  it('does not reject a short password on login', () => {
    expect(validateLoginInput({ email: 'a@b.co', password: 'abc' }).ok).toBe(true)
  })

  it('rejects missing credentials', () => {
    expect(validateLoginInput({ email: '', password: 'x' }).ok).toBe(false)
    expect(validateLoginInput({ email: 'a@b.co', password: '' }).ok).toBe(false)
    expect(validateLoginInput({ email: null, password: null }).ok).toBe(false)
  })
})
