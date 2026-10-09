'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateLoginInput, validateSignupInput } from '@/lib/auth/credentials'
import { headers } from 'next/headers'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for the auth helper functions.
 *
 * log_login_attempt, check_login_rate_limit, log_email_resend,
 * check_email_resend_cooldown, check_user_confirmed and login_hint_for_email
 * are granted to `service_role` only (migration 20261009120000). They used to
 * be callable with the public anon key, which let anyone lock an account out
 * by logging fake failures against its email.
 *
 * Returns null when the key is missing so auth degrades to "no rate limit"
 * with a loud log line instead of refusing every login.
 */
function getAuthAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[Auth] SUPABASE_SERVICE_ROLE_KEY is not set — login rate limiting is NOT active.')
    return null
  }
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Turnstile is enforced only when it is configured.
 *
 *   both keys set   -> enforced; a missing or rejected token fails.
 *   neither key set -> off. The widget is not rendered without a site key, so
 *                      no submission can ever carry a token; enforcing here
 *                      would refuse every login and signup on that deployment.
 *   only one set    -> refused. That is a real misconfiguration (a widget with
 *                      nothing to verify it, or a check nobody can pass).
 */
async function verifyTurnstileToken(token: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  if (!secret && !siteKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Auth] Turnstile is not configured on this deployment — bot check skipped.')
    }
    return true
  }
  if (!secret || !siteKey) {
    console.error(
      '[Auth] REFUSED — Turnstile is half configured. Set both TURNSTILE_SECRET_KEY and ' +
        'NEXT_PUBLIC_TURNSTILE_SITE_KEY, or neither.'
    )
    return false
  }
  if (!token) return false

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('Turnstile verification failed', err)
    return false
  }
}

/**
 * Client IP, or null when it cannot be determined.
 *
 * x-forwarded-for is a comma-separated chain; the first entry is the client.
 * Null rather than a placeholder address: the rate limiter matches on
 * `ip_address = p_ip`, so a shared fallback value would pool every such
 * request into one bucket and let one caller lock out all the others.
 */
async function getIpAddress(): Promise<string | null> {
  const headersList = await headers()
  const first = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
  return first || null
}

export async function loginAction(formData: FormData) {
  const parsed = validateLoginInput({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.ok) {
    return { error: parsed.error }
  }
  const { email, password } = parsed.value

  const turnstileToken = formData.get('cf-turnstile-response') as string | null
  const isValid = await verifyTurnstileToken(turnstileToken)
  if (!isValid) return { error: 'Failed security check. Please try again.' }

  const ip = await getIpAddress()
  const supabase = await createClient()
  const admin = getAuthAdmin()

  // Check brute-force rate limit. An RPC error is logged and treated as
  // "allowed": refusing every login because the limiter is unreachable would
  // turn a database blip into an outage.
  if (admin) {
    const { data: canLogin, error: limitError } = await admin.rpc('check_login_rate_limit', { p_email: email, p_ip: ip })
    if (limitError) console.error('[Auth] check_login_rate_limit failed:', limitError.message)
    if (canLogin === false) {
      return { error: 'Too many attempts. Please try again later.' }
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (admin) {
    const { error: logError } = await admin.rpc('log_login_attempt', { p_email: email, p_ip: ip, p_success: !error })
    if (logError) console.error('[Auth] log_login_attempt failed:', logError.message)
  }

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      const { data: hint } = admin
        ? await admin.rpc('login_hint_for_email', { p_email: email })
        : { data: null }
      if (hint === 'google') {
        return {
          error:
            'This email is registered with Google. Use the “Continue with Google” button above to sign in.',
        }
      }
      if (hint === 'oauth') {
        return {
          error:
            'This email is registered through a social login. Use the social sign-in option above.',
        }
      }
      return { error: 'Invalid email or password. Please try again.' }
    } else if (error.message.includes('rate limit')) {
      return { error: 'Too many attempts. Please try again later.' }
    }
    return { error: 'An error occurred during login. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signupAction(formData: FormData) {
  const parsed = validateSignupInput({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  })
  if (!parsed.ok) {
    return { error: parsed.error }
  }
  const { email, password, name } = parsed.value

  const turnstileToken = formData.get('cf-turnstile-response') as string | null
  const isValid = await verifyTurnstileToken(turnstileToken)
  if (!isValid) return { error: 'Failed security check. Please try again.' }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        name: name,
      },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      // Check if unconfirmed
      const admin = getAuthAdmin()
      const { data: isConfirmed } = admin
        ? await admin.rpc('check_user_confirmed', { p_email: email })
        : { data: null }
      if (isConfirmed === false) {
        return { error: 'already_registered_unconfirmed', email }
      }
      return { error: 'An account with this email already exists.' }
    } else if (error.message.includes('weak')) {
      return { error: 'Password is too weak. Please use a stronger password.' }
    } else if (error.message.includes('rate limit')) {
      return { error: 'Too many attempts. Please try again later.' }
    }
    return { error: 'An error occurred during signup. Please try again.' }
  }

  revalidatePath('/', 'layout')
  
  if (!data.session) {
    return { success: true, needsEmailConfirmation: true }
  }

  return { success: true }
}

export async function resendVerificationEmailAction(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email is required' }

  const ip = await getIpAddress()
  const supabase = await createClient()
  const admin = getAuthAdmin()

  const { data: canResend } = admin
    ? await admin.rpc('check_email_resend_cooldown', { p_email: email, p_ip: ip })
    : { data: null }
  if (canResend === false) {
    return { error: 'Please wait a minute before requesting another email.' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) return { error: 'Failed to send verification email. Please try again.' }

  if (admin) await admin.rpc('log_email_resend', { p_email: email, p_ip: ip })
  return { success: true }
}

export async function oauthLoginAction(provider: 'google' | 'github', nextUrl: string) {
  const supabase = await createClient()
  
  const callbackUrl = new URL('/auth/callback', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  callbackUrl.searchParams.set('next', nextUrl)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    return { url: data.url }
  }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
