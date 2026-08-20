import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth/safe-next-path'

/**
 * The OTP types this callback will act on. Supabase's `verifyOtp` accepts the
 * `type` straight from the query string, so it is checked against this list
 * rather than cast — an unknown value now fails as a clean "invalid link"
 * instead of reaching the client as a malformed request.
 */
const VERIFIABLE_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'email',
  'recovery',
  'invite',
  'email_change',
]

function isVerifiableOtpType(value: string): value is EmailOtpType {
  return (VERIFIABLE_OTP_TYPES as readonly string[]).includes(value)
}

/**
 * Unified auth callback handler.
 *
 * Handles ALL Supabase auth callbacks through a single route:
 *   1. PKCE code exchange — used by OAuth providers (Google, GitHub)
 *      and email verification when PKCE flow is enabled.
 *      Supabase sends: ?code=<PKCE_CODE>
 *
 *   2. Token hash verification — used by email verification
 *      when Supabase sends a token_hash in the confirmation link.
 *      Supabase sends: ?token_hash=<HASH>&type=signup
 *
 *   3. Password recovery — type=recovery
 *
 * After successful authentication, the user is redirected to /dashboard.
 * On failure, the user is sent to /login with an error message.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  // If Supabase itself returned an error (e.g., expired link)
  if (error_param) {
    const message = error_description || error_param || 'Authentication failed'
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    )
  }

  const supabase = await createClient()

  // Flow 1: PKCE code exchange (OAuth + email verification with PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Password recovery — redirect to the update-password form
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/forgot-password?verified=true`)
      }

      // `origin` is this deployment's own origin, so redirecting relative to it
      // is correct on every alias (branch previews, the production alias, and
      // localhost) without maintaining a hostname allowlist. The previous
      // allowlist named three domains this project has never deployed to, so
      // its x-forwarded-host branch could never fire and every request already
      // fell through to exactly this line.
      return NextResponse.redirect(`${origin}${safeNextPath(next)}`)
    }
    // Code exchange failed — fall through to error redirect
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'Code exchange failed')}`
    )
  }

  // Flow 2: Token hash verification (email verification / recovery)
  if (token_hash && type) {
    if (!isVerifiableOtpType(type)) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Invalid authentication link')}`
      )
    }

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      // Recovery hands off to the "set a new password" step; every other type
      // is now a live session, so honour where the user was headed.
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/forgot-password?verified=true`)
      }
      return NextResponse.redirect(`${origin}${safeNextPath(next)}`)
    }
    // Verification failed
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'Email verification failed')}`
    )
  }

  // No code or token_hash present — invalid callback
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Invalid authentication callback')}`
  )
}
