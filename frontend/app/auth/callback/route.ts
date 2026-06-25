import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      // Ensure 'next' is a valid internal relative path
      // Reject any path starting with // (protocol-relative) or http (absolute)
      const isSafePath = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('\\')
      const safeNext = isSafePath ? next : '/dashboard'

      // Only trust x-forwarded-host in production if it matches our Vercel domain or allowed domains
      const allowedHosts = [
        'opportunity-radar.com',
        'www.opportunity-radar.com',
        'opportunity-radar.vercel.app'
      ]

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${safeNext}`)
      } else if (forwardedHost && allowedHosts.includes(forwardedHost)) {
        return NextResponse.redirect(`https://${forwardedHost}${safeNext}`)
      } else {
        return NextResponse.redirect(`${origin}${safeNext}`)
      }
    }
    // Code exchange failed — fall through to error redirect
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'Code exchange failed')}`
    )
  }

  // Flow 2: Token hash verification (email verification / recovery)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email' | 'recovery' | 'invite',
    })
    if (!error) {
      // For recovery type, redirect to a password reset page if it exists,
      // otherwise dashboard
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/forgot-password?verified=true`)
      }
      // Email verified — session is now active, go to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
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
