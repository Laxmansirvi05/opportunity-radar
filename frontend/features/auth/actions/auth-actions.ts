'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

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
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (!email || !password || !name) {
    return { error: 'Name, email, and password are required' }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
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
