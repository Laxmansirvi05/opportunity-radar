'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateLoginInput, validateSignupInput } from '@/lib/auth/credentials'

export async function loginAction(formData: FormData) {
  const parsed = validateLoginInput({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.ok) {
    return { error: parsed.error }
  }
  const { email, password } = parsed.value

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
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

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // Sent under both keys: the public.handle_new_user() trigger reads
        // raw_user_meta_data->>'name' when creating the profiles row, but
        // this form only ever sent 'full_name' — every signup's display
        // name silently fell back to the email's local-part. Fixed at the
        // trigger too (see migration 20260816090000), but that requires a
        // deploy the owner hasn't run yet, so this keeps new signups
        // correct in the meantime regardless of which key the trigger reads.
        full_name: name,
        name: name,
      },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
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

export async function oauthLoginAction(provider: 'google' | 'github', nextUrl: string) {
  const supabase = await createClient()
  
  // We need to construct the callback URL to include the next URL
  // so the user is redirected back to the correct page after login
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
