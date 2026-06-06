import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Ensures the user is authenticated. If not, redirects to the specified path.
 * Call this in Server Components that require authentication.
 */
export async function requireUser(redirectTo = '/login') {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(redirectTo)
  }

  return user
}

/**
 * Returns the authenticated user if they exist, or null if they don't.
 * Call this in Server Components where authentication is optional.
 */
export async function getOptionalUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
