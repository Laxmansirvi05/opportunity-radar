'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function deleteAccountAction() {
  const supabase = await createClient()
  
  // Call the secure RPC function to delete the authenticated user
  const { error } = await supabase.rpc('delete_user')

  if (error) {
    console.error('Account deletion error:', error)
    return { error: 'Failed to delete account. Please try again.' }
  }

  // Sign out the user locally after successful backend deletion
  await supabase.auth.signOut()

  // Redirect to login
  redirect('/login')
}
