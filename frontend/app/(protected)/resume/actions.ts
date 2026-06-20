'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { defaultResumeData } from '@/lib/resume-toolkit/schema/resume/default'

export async function createResumeAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Create a new resume with default data
  // file_url is nullable for builder-created resumes
  // status must be a valid resume_status enum value
  const { data: newResume, error } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      title: 'Untitled Resume',
      data: defaultResumeData,
      status: 'uploaded',
      file_name: 'Created with Builder'
    })
    .select('id')
    .single()

  if (error || !newResume) {
    console.error('Failed to create resume:', error)
    throw new Error(`Failed to create resume: ${error?.message || 'Unknown error'}`)
  }

  redirect(`/resume/builder/${newResume.id}`)
}

export async function saveResumeAction(resumeId: string, title: string, resumeData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('resumes')
    .update({
      title,
      data: resumeData,
      // updated_at is handled by the DB trigger
    })
    .eq('id', resumeId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to save resume:', error)
    throw new Error('Failed to save resume')
  }

  revalidatePath(`/resume/builder/${resumeId}`)
  revalidatePath('/resume')

  return { success: true }
}
