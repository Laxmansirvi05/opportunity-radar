'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ProfileUpdateData = {
  name: string
  university: string | null
  degree: string | null
  graduation_year: number | null
  skills: string[]
  interests: string[]
  career_goal: string | null
}

export type ResumeUpdateData = {
  resume_url: string | null
  resume_name: string | null
  resume_size: number | null
}

export async function updateProfile(data: ProfileUpdateData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate graduation year if present
  if (data.graduation_year && (data.graduation_year < 1900 || data.graduation_year > 2100)) {
    return { success: false, error: 'Invalid graduation year' }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      name: data.name,
      university: data.university,
      degree: data.degree,
      graduation_year: data.graduation_year,
      skills: data.skills,
      interests: data.interests,
      career_goal: data.career_goal,
    }, { onConflict: 'id' })

  if (error) {
    console.error('Failed to update profile', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

export async function updateResume(data: ResumeUpdateData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      resume_url: data.resume_url,
      resume_name: data.resume_name,
      resume_size: data.resume_size,
      resume_updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update resume metadata', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}
