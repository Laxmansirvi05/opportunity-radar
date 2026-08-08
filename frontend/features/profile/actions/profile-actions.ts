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
  city: string | null
  gpa: string | null
  bio: string | null
  github_url: string | null
  linkedin_url: string | null
}

export type ResumeUpdateData = {
  resume_url: string | null
  resume_name: string | null
  resume_size: number | null
  resume_updated_at?: string | null
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

  // Validate GitHub URL if present
  if (data.github_url && data.github_url.trim()) {
    const gh = data.github_url.trim()
    if (!gh.startsWith('https://github.com/') && !gh.startsWith('http://github.com/') && !gh.startsWith('github.com/')) {
      return { success: false, error: 'GitHub URL must start with https://github.com/' }
    }
    // Normalize: ensure https prefix
    if (gh.startsWith('github.com/')) {
      data.github_url = 'https://' + gh
    }
  }

  // Validate LinkedIn URL if present
  if (data.linkedin_url && data.linkedin_url.trim()) {
    const li = data.linkedin_url.trim()
    if (!li.startsWith('https://linkedin.com/') && !li.startsWith('https://www.linkedin.com/') && !li.startsWith('http://linkedin.com/') && !li.startsWith('http://www.linkedin.com/') && !li.startsWith('linkedin.com/') && !li.startsWith('www.linkedin.com/')) {
      return { success: false, error: 'LinkedIn URL must be a valid linkedin.com link' }
    }
    if (li.startsWith('linkedin.com/') || li.startsWith('www.linkedin.com/')) {
      data.linkedin_url = 'https://' + li
    }
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
      city: data.city,
      gpa: data.gpa,
      bio: data.bio,
      github_url: data.github_url,
      linkedin_url: data.linkedin_url,
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
      resume_updated_at: data.resume_updated_at !== undefined ? data.resume_updated_at : new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update resume metadata', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

export async function updateAvatarUrl(avatarUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update avatar URL', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout') // revalidate sidebar user info
  return { success: true }
}
