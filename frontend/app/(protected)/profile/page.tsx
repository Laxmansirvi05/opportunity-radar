import { createClient } from '@/lib/supabase/server'
import { ProfileManager } from '@/features/profile/components/profile-manager'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'User Profile | Opportunity Radar',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return notFound()
  }

  // Fetch real profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // If profile is missing (e.g. trigger failed on signup), create an empty mock
    // so the page can load and the user can hit Save to trigger an upsert.
  }

  // Fetch real tracker stats
  const { data: trackerData } = await supabase
    .from('application_tracker')
    .select('status')
    .eq('user_id', user.id)

  const stats = {
    saved: 0,
    applied: 0,
    interviews: 0
  }

  if (trackerData) {
    for (const row of trackerData) {
      if (row.status === 'Saved') stats.saved++
      else if (row.status === 'Applied') stats.applied++
      else if (row.status === 'Interview Scheduled') stats.interviews++
    }
    // Note: If you have Offer or Rejected, they also count as Applied since they are downstream
    for (const row of trackerData) {
        if (row.status === 'Selected' || row.status === 'Rejected') {
            stats.applied++
        }
    }
  }

  const initialProfileData = {
    id: profile?.id || user.id,
    name: profile?.name || '',
    email: profile?.email || user.email || '',
    university: profile?.university || null,
    degree: profile?.degree || null,
    graduation_year: profile?.graduation_year || null,
    skills: profile?.skills || [],
    interests: profile?.interests || [],
    career_goal: profile?.career_goal || null,
    city: profile?.city || null,
    gpa: profile?.gpa || null,
    resume_name: profile?.resume_name || null,
    resume_size: profile?.resume_size || null,
    resume_updated_at: profile?.resume_updated_at || null,
    resume_url: profile?.resume_url || null
  }

  return <ProfileManager initialProfile={initialProfileData} stats={stats} />
}
