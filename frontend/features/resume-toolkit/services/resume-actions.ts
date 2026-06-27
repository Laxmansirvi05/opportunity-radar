'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ResumeData } from '@/features/resume-toolkit/lib/schema/resume/data'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/^-|-$/g, '')
    || 'untitled'
}

export async function createResume(title: string, data: ResumeData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const baseSlug = generateSlug(title || 'Untitled Resume')
  // Ensure slug is unique for this user
  const { count } = await supabase
    .from('resumes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('slug', `${baseSlug}%`)

  const slug = count && count > 0 ? `${baseSlug}-${count}` : baseSlug

  const { data: resume, error } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      title: title || 'Untitled Resume',
      slug,
      data,
    })
    .select('id, slug')
    .single()

  if (error) {
    console.error('Failed to create resume', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/resume')
  return { success: true, slug: resume.slug, id: resume.id }
}

export async function updateResume(id: string, updates: { title?: string; data?: ResumeData }) {
  const supabase = await createClient()

  const updatePayload: Record<string, unknown> = {}
  if (updates.title !== undefined) updatePayload.title = updates.title
  if (updates.data !== undefined) updatePayload.data = updates.data

  const { error } = await supabase
    .from('resumes')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    console.error('Failed to update resume', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/resume')
  return { success: true }
}

export async function deleteResume(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('resumes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete resume', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/resume')
  return { success: true }
}

export async function getResumeBySlug(slug: string) {
  const supabase = await createClient()

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('id, title, slug, data, created_at, updated_at')
    .eq('slug', slug)
    .single()

  if (error) {
    return { success: false, error: error.message, resume: null }
  }

  return { success: true, resume }
}

export async function listResumes() {
  const supabase = await createClient()

  const { data: resumes, error } = await supabase
    .from('resumes')
    .select('id, title, slug, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to list resumes', error)
    return { success: false, error: error.message, resumes: [] }
  }

  return { success: true, resumes: resumes || [] }
}
