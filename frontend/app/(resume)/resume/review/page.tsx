import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResumeReviewForm } from '@/features/resume/components/resume-review-form'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'

export default async function ResumeReviewPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const resumeId = resolvedSearchParams.resume_id as string

  if (!resumeId) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch the exact resume
  const { data: resumeRow, error: fetchError } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !resumeRow) {
    redirect('/dashboard')
  }

  // If status is 'uploaded', transition to 'reviewing'
  if (resumeRow.status === 'uploaded') {
    await supabase
      .from('resumes')
      .update({ status: 'reviewing' })
      .eq('id', resumeId)
  }

  // Ensure we pass type-safe ResumeData
  const initialData = resumeRow.parsed_data as ResumeData

  return (
    <div className="container mx-auto py-8 px-4">
      <ResumeReviewForm resumeId={resumeRow.id} initialData={initialData} />
    </div>
  )
}
