import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { CreateResumeCard } from '../_components/create-resume'
import { UploadResumeCard } from '../_components/upload-resume'
import { ResumeCard } from '../_components/resume-card'
import { SupabaseResume } from '@/lib/resume-toolkit/compatibility'

export const metadata = {
  title: 'Resumes | Opportunity Radar',
}

export default async function ResumesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all resumes for this user, ordered by last updated
  const { data: resumes, error } = await supabase
    .from('resumes')
    .select('id, file_name, status, updated_at, created_at, parsed_data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching resumes:', error)
  }

  const resumeList = (resumes || []) as SupabaseResume[]

  return (
    <div className="flex-1 space-y-8 p-8 md:p-12 lg:p-16">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Resumes</h2>
          <p className="text-muted-foreground">
            Create, manage, and track your resumes here.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <CreateResumeCard />
        <UploadResumeCard />
        
        {resumeList.map((resume) => (
          <ResumeCard 
            key={resume.id} 
            resume={resume} 
          />
        ))}
      </div>
    </div>
  )
}
