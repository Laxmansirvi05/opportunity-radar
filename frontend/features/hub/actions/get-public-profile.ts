'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { filterToHubParticipants, UUID_RE } from '../lib/hub-participants'

/**
 * The profile shown when a Hub member taps a message sender.
 *
 * This is a server action, so `userId` arrives straight from the caller and the
 * read below uses the service-role key to get past the `auth.uid() = id` SELECT
 * policy on `profiles`. That combination was unbounded: any authenticated user
 * could invoke this with any id and read back that person's name, avatar, bio,
 * university, degree, graduation year, skills, LinkedIn, GitHub, email and
 * achievements, whether or not they had ever set foot in the Hub.
 *
 * The privileged read is genuinely needed — a shared room means showing other
 * people's profiles — so the fix is a bound rather than a removal: resolve only
 * ids that have posted in the Hub, and therefore whose presence the caller can
 * already see. Returns null for anyone else, which the modal already handles by
 * falling back to the basic sender info it was passed.
 */
export async function getPublicProfile(userId: string) {
  // Ensure the requester is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Reject anything that is not a uuid before it reaches a query. Postgres
  // rejects the whole statement on a bad uuid literal, so this is the
  // difference between an empty result and a 500.
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) return null

  // Checked with the caller's own client, so it reflects what they can see.
  // A caller may always look up their own profile.
  if (userId !== user.id) {
    const participants = await filterToHubParticipants(supabase, [userId])
    if (participants.length === 0) return null
  }

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
