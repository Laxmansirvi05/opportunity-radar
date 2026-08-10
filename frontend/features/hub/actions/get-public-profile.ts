'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function getPublicProfile(userId: string) {
  // Ensure the requester is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Use service role to bypass RLS for public profile information
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('id, email, name, avatar_url, bio, university, degree, graduation_year, skills, linkedin_url, github_url')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[Hub] Failed to fetch public profile:', error)
    return null
  }

  // Fetch user achievements (projects/certifications)
  const { data: achievements } = await adminSupabase
    .from('achievements')
    .select('id, title, organization, date_year, credential_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return {
    ...profile,
    achievements: achievements || []
  }
}
