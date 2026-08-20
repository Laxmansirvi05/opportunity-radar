/**
 * Server-side validation for the signup and login forms.
 *
 * The forms already carry `required`, `type="email"` and `minLength={6}`, but
 * those are browser conveniences — a server action is a plain HTTP endpoint
 * and can be called without ever rendering the form. Supabase would reject a
 * too-short password on its own, but only as a generic error the action then
 * has to pattern-match; validating here produces the specific message and
 * keeps the rule visible in our own code rather than in project settings.
 *
 * Deliberately minimal: no address-shape cleverness beyond a sanity check.
 * Whether an address can actually receive mail is decided by the verification
 * email, not by a regular expression.
 */

/** Matches Supabase's own default minimum. */
export const MIN_PASSWORD_LENGTH = 6

/** Guards against unbounded input reaching the auth provider. */
export const MAX_EMAIL_LENGTH = 254
export const MAX_NAME_LENGTH = 100

export interface SignupInput {
  email: string
  password: string
  name: string
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

function normaliseEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

/** A single `@` with something either side, and no whitespace. */
function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateSignupInput(
  raw: { email: unknown; password: unknown; name: unknown }
): ValidationResult<SignupInput> {
  const email = normaliseEmail(raw.email)
  const password = typeof raw.password === 'string' ? raw.password : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''

  if (!name || !email || !password) {
    return { ok: false, error: 'Name, email, and password are required' }
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'That name is too long.' }
  }
  if (email.length > MAX_EMAIL_LENGTH || !looksLikeEmail(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }

  return { ok: true, value: { email, password, name } }
}

export function validateLoginInput(
  raw: { email: unknown; password: unknown }
): ValidationResult<{ email: string; password: string }> {
  const email = normaliseEmail(raw.email)
  const password = typeof raw.password === 'string' ? raw.password : ''

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required' }
  }

  // Login deliberately does not check the password's shape: the rules may have
  // changed since the account was made, and "your password is too short" on a
  // login screen tells an attacker something about the stored credential.
  return { ok: true, value: { email, password } }
}
