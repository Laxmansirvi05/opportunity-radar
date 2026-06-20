import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { defaultResumeData } from '@/lib/resume-toolkit/schema/resume/default'

export default async function NewResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Create a new resume with default data
  // file_url is nullable for builder-created resumes
  // status must be a valid resume_status enum value
  const payload = {
    user_id: user.id,
    data: defaultResumeData,
    status: 'uploaded' as const,
    file_name: 'Created with Builder',
  }

  console.log('--- RESUME BUILDER INSERT DEBUG ---')
  console.log('Authenticated User ID:', user.id)
  console.log('Supabase Insert Payload:', JSON.stringify(payload, null, 2))

  const { data: newResume, error } = await supabase
    .from('resumes')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('Exact Supabase Error Object:', JSON.stringify(error, null, 2))
  }

  if (error || !newResume) {
    console.error('Failed to create resume:', error)
    return (
      <div className="p-lg flex flex-col items-center justify-center gap-md">
        <span className="material-symbols-outlined text-error text-4xl">error</span>
        <h2 className="text-title-lg text-error">Failed to create resume</h2>
        <p className="text-body-md text-on-surface-variant">{error?.message || 'Unknown error'}</p>
      </div>
    )
  }

  redirect(`/resume/builder/${newResume.id}`)
}
