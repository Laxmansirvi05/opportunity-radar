'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ResumeData } from '@reactive-resume/schema/resume/data'
import { convertResumeDataToParsedResume, looksLikeParsedResume } from '@/lib/resume-optimizer/convert-resume-data'
import type { ParsedResume } from '@/types/resume'

/**
 * Normalizes `resumes.parsed_data` (which may be in either the Resume
 * Builder's nested shape or the flat ParsedResume shape) into one consistent
 * ParsedResume — used both for the list's title (the candidate's own name is
 * far more useful than the upload placeholder "Untitled Resume" every resume
 * otherwise shares) and to feed the "preview" action without a second fetch.
 */
function toParsedResume(raw: unknown): ParsedResume | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  try {
    return looksLikeParsedResume(data) ? (data as unknown as ParsedResume) : convertResumeDataToParsedResume(data)
  } catch {
    return null
  }
}

function titleFromParsedResume(resume: ParsedResume | null): string | null {
  const name = resume?.name?.trim() ?? ''
  return name && name !== 'Unknown Candidate' ? name : null
}

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

export async function createResume(
  title: string,
  data: ResumeData,
  metadata?: { slug?: string; tags?: string[] },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { data: resume, error } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      file_name: title || 'Untitled Resume',
      status: 'verified',
      parsed_data: data,
    })
    .select('id, file_name')
    .single()

  if (error) {
    console.error('Failed to create resume', error)
    return { success: false as const, error: error.message }
  }

  return { success: true as const, slug: generateSlug(metadata?.slug || resume.file_name), id: resume.id }
}

export async function getResumeById(id: string) {
  const supabase = await createClient()

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('id, file_name, parsed_data, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    return { success: false as const, error: error.message, resume: null }
  }

  return {
    success: true as const,
    resume: {
      ...resume,
      title: resume.file_name,
      data: resume.parsed_data,
      slug: resume.id,
      tags: [] as string[],
      is_public: false,
      is_locked: false,
    },
  }
}

export async function updateResume(
  id: string,
  updates: {
    title?: string
    data?: ResumeData
    slug?: string
    tags?: string[]
    is_public?: boolean
    is_locked?: boolean
  },
) {
  const supabase = await createClient()

  const updatePayload: Record<string, unknown> = {}
  if (updates.title !== undefined) updatePayload.file_name = updates.title
  if (updates.data !== undefined) updatePayload.parsed_data = updates.data

  const { data: resume, error } = await supabase
    .from('resumes')
    .update(updatePayload)
    .eq('id', id)
    .select('id, file_name')
    .single()

  if (error) {
    console.error('Failed to update resume', error)
    return { success: false as const, error: error.message }
  }

  return {
    success: true as const,
    resume: {
      ...resume,
      title: resume.file_name,
      slug: resume.id,
      tags: updates.tags || [],
      is_public: updates.is_public || false,
      is_locked: updates.is_locked || false,
    },
  }
}

/**
 * Patch only the `data` JSONB column of a resume.
 * Used by the builder's autosave debounce to persist draft changes.
 */
export async function patchResumeData(id: string, data: ResumeData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('resumes')
    .update({ parsed_data: data, status: 'verified' })
    .eq('id', id)

  if (error) {
    console.error('Failed to patch resume data', error)
    return { success: false as const, error: error.message }
  }

  return { success: true as const }
}

export async function deleteResume(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('resumes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete resume', error)
    return { success: false as const, error: error.message }
  }

  revalidatePath('/resume')
  return { success: true as const }
}

export async function duplicateResume(
  id: string,
  metadata?: { title?: string; slug?: string; tags?: string[] },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const result = await getResumeById(id)
  if (!result.success || !result.resume) {
    return { success: false as const, error: result.error || 'Resume not found' }
  }

  const original = result.resume
  const newTitle = metadata?.title || `${original.title} (Copy)`
  return createResume(newTitle, original.data as ResumeData, {
    slug: metadata?.slug,
    tags: metadata?.tags ?? original.tags ?? [],
  })
}

export async function getResumeBySlug(slug: string) {
  const supabase = await createClient()

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('id, file_name, parsed_data, created_at, updated_at')
    .eq('id', slug)
    .single()

  if (error) {
    return { success: false as const, error: error.message, resume: null }
  }

  return {
    success: true as const,
    resume: {
      ...resume,
      title: resume.file_name,
      data: resume.parsed_data,
      slug: resume.id,
      tags: [] as string[],
      is_public: false,
      is_locked: false,
    },
  }
}

export async function listResumes() {
  const supabase = await createClient()

  const { data: resumes, error } = await supabase
    .from('resumes')
    .select('id, file_name, parsed_data, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to list resumes', error)
    return { success: false as const, error: error.message, resumes: [] }
  }

  return {
    success: true as const,
    resumes: (resumes || []).map(({ parsed_data, ...resume }) => {
      const parsedResume = toParsedResume(parsed_data)
      return {
        ...resume,
        title: titleFromParsedResume(parsedResume) || resume.file_name || 'Untitled Resume',
        // Lets the client preview the actual extracted/saved content in a
        // scrollable modal without a second round-trip — null when parsing
        // hasn't produced anything usable yet (e.g. still mid-extraction).
        parsedResume,
        slug: resume.id,
        tags: [] as string[],
        is_public: false,
        is_locked: false,
      }
    }),
  }
}
