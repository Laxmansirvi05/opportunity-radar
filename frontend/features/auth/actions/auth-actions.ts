'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateLoginInput, validateSignupInput } from '@/lib/auth/credentials'
import { headers } from 'next/headers'

async function verifyTurnstileToken(token: string | null) {
  if (!token) return false
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // Bypass if not configured in environment

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`
    })
    const data = await res.json()
    return data.success
  } catch (err) {
    console.error('Turnstile verification failed', err)
    return false
  }
}

async function getIpAddress() {
  const headersList = await headers()
  return headersList.get('x-forwarded-for') || '127.0.0.1'
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

  // Check brute-force rate limit
  const { data: canLogin } = await supabase.rpc('check_login_rate_limit', { p_email: email, p_ip: ip })
  if (canLogin === false) {
    return { error: 'Too many attempts. Please try again later.' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // Log attempt
  await supabase.rpc('log_login_attempt', { p_email: email, p_ip: ip, p_success: !error })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      const { data: hint } = await supabase.rpc('login_hint_for_email', {
        p_email: email,
      })
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
      const { data: isConfirmed } = await supabase.rpc('check_user_confirmed', { p_email: email })
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

  const { data: canResend } = await supabase.rpc('check_email_resend_cooldown', { p_email: email, p_ip: ip })
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

  await supabase.rpc('log_email_resend', { p_email: email, p_ip: ip })
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
