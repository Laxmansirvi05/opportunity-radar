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

  // Fetch real profile data and tracker stats concurrently
  const [
    { data: profile },
    { data: trackerData }
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, university, degree, graduation_year, skills, interests, career_goal, city, gpa, resume_name, resume_size, resume_updated_at, resume_url, avatar_url, github_url, linkedin_url, bio')
      .eq('id', user.id)
      .single(),
    supabase
      .from('application_tracker')
      .select('status')
      .eq('user_id', user.id)
  ])

  // If profile is missing (e.g. the signup trigger failed), the page still
  // renders from the auth user below so the student can hit Save and upsert one.

  const stats = {
    total: 0,
    applied: 0,
    interviewing: 0,
    offers: 0,
    responseRate: null as number | null
  }

  if (trackerData) {
    stats.total = trackerData.length;
    
    let appliedCount = 0;
    let interviewCount = 0;
    let offerCount = 0;
    let rejectedCount = 0;

    for (const row of trackerData) {
      if (row.status === 'Applied') appliedCount++;
      else if (row.status === 'Interview Scheduled') interviewCount++;
      else if (row.status === 'Selected') offerCount++;
      else if (row.status === 'Rejected') rejectedCount++;
    }

    stats.applied = appliedCount + interviewCount + offerCount + rejectedCount;
    stats.interviewing = interviewCount;
    stats.offers = offerCount;

    const responses = interviewCount + offerCount + rejectedCount;
    stats.responseRate = stats.applied > 0 ? Math.round((responses / stats.applied) * 100) : null;
  }

  const initialProfileData = {
    id: profile?.id || user.id,
    name: profile?.name || user.user_metadata?.full_name || '',
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
    resume_url: profile?.resume_url || null,
    avatar_url: profile?.avatar_url || null,
    github_url: profile?.github_url || null,
    linkedin_url: profile?.linkedin_url || null,
    bio: profile?.bio || null
  }

  return <ProfileManager initialProfile={initialProfileData} stats={stats} />
}
