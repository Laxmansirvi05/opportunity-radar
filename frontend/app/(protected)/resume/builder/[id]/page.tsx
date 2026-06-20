import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ResumeEditor } from './resume-editor'

export const metadata = {
  title: 'Resume Builder | Opportunity Radar',
}

export default async function ResumeBuilderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('id, file_name, data, parsed_data')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !resume) {
    console.error('Failed to load resume:', error)
    return <div className="p-lg">Resume not found.</div>
  }

  // Fallback to parsed_data if data is not present (as per instruction: For uploaded resumes: parsed_data -> Resume Builder editor -> saved into data)
  let initialData = resume.data
  if (!initialData && resume.parsed_data) {
    // Attempt to map parsed_data to ResumeData if possible, or just start empty.
    // For now, we will pass parsed_data as a fallback so the editor can use it.
    initialData = resume.parsed_data // Assuming it's somewhat compatible or will be mapped in the editor
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <ResumeEditor 
        resumeId={resume.id} 
        initialTitle={resume.file_name || 'Untitled Resume'} 
        initialData={initialData} 
      />
    </div>
  )
}
