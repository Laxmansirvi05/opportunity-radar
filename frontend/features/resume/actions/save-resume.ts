'use server'

import { createClient } from '@/lib/supabase/server'
import { resumeDataSchema, ResumeData } from '@/src/lib/resume-ai/schema/data'

export async function saveResumeAction(resumeId: string, data: ResumeData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate incoming payload
    const parsedData = resumeDataSchema.parse(data)

    // Extract skills for ATS engine
    const extractedSkills = [
      ...new Set(
        (parsedData.sections?.skills?.items || [])
          .map((s: any) => s.name?.toLowerCase().trim())
          .filter(Boolean)
      )
    ].sort()

    const extractedProjectKeywords = [
      ...new Set(
        (parsedData.sections?.projects?.items || [])
          .flatMap((p: any) => (p.description || '').toLowerCase().split(/\\s+/)) // Simplified keyword extraction if no tags array exists
          .filter((t: string) => t.length > 2 && !extractedSkills.includes(t))
      )
    ].sort()

    // Save to database
    const { error: dbError } = await supabase
      .from('resumes')
      .update({
        parsed_data: parsedData,
        extracted_skills: extractedSkills,
        extracted_project_keywords: extractedProjectKeywords,
        status: 'verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId)
      .eq('user_id', user.id)

    if (dbError) {
      console.error('[saveResumeAction] DB Error:', dbError)
      return { success: false, error: 'Failed to save resume changes.' }
    }

    return { success: true }
  } catch (error) {
    console.error('[saveResumeAction] Error:', error)
    return { success: false, error: 'Validation or server error occurred.' }
  }
}
