import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'Resume Toolkit | Opportunity Radar',
}

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch the latest resume for this user
  const { data: resumes } = await supabase
    .from('resumes')
    .select('id, file_name, status, updated_at, parsed_data')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const resume = resumes && resumes.length > 0 ? resumes[0] : null
  const hasResume = !!resume
  
  // Basic calculation for completion if verified
  let completionPct = 0
  if (hasResume && resume.parsed_data) {
    const data = resume.parsed_data as any
    let sectionsFilled = 0
    let totalSections = 5
    if (data.personal_info?.name) sectionsFilled++
    if (data.sections?.education?.items?.length > 0) sectionsFilled++
    if (data.sections?.experience?.items?.length > 0) sectionsFilled++
    if (data.sections?.projects?.items?.length > 0) sectionsFilled++
    if (data.sections?.skills?.items?.length > 0) sectionsFilled++
    completionPct = Math.round((sectionsFilled / totalSections) * 100)
  }

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'uploaded': return { label: 'Uploaded (Needs Parsing)', color: 'text-secondary' }
      case 'reviewing': return { label: 'Review in Progress', color: 'text-secondary' }
      case 'review_required': return { label: 'Needs Review', color: 'text-error' }
      case 'verified': return { label: 'Verified', color: 'text-primary' }
      default: return { label: status, color: 'text-on-surface' }
    }
  }

  const statusInfo = resume ? getStatusDisplay(resume.status) : { label: 'Missing', color: 'text-error' }

  return (
    <div className="flex flex-col gap-xl">
      <header className="mb-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-xs">
          Resume Toolkit
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage your resume, parse it for ATS, and keep it up to date.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <section className="bg-surface border border-outline-variant rounded-2xl p-md shadow-sm">
          <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
            <span className="material-symbols-outlined text-primary">description</span>
            Current Resume
          </h3>
          
          <div className="space-y-md">
            <div className="flex justify-between items-center border-b border-outline-variant/50 pb-sm">
              <span className="font-label-md text-on-surface-variant">Status</span>
              <span className={`font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
            
            <div className="flex justify-between items-center border-b border-outline-variant/50 pb-sm">
              <span className="font-label-md text-on-surface-variant">File Name</span>
              <span className="font-bold text-on-background">{resume?.file_name || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center border-b border-outline-variant/50 pb-sm">
              <span className="font-label-md text-on-surface-variant">Last Updated</span>
              <span className="font-bold text-on-background">
                {resume?.updated_at ? new Date(resume.updated_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-outline-variant/50 pb-sm">
              <span className="font-label-md text-on-surface-variant">Completion</span>
              <span className="font-bold text-on-background">{resume ? `${completionPct}%` : 'N/A'}</span>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md">
          <h3 className="font-headline-sm text-on-background mb-md flex items-center gap-2 border-b border-outline-variant pb-sm font-bold">
            <span className="material-symbols-outlined text-primary">build</span>
            Actions
          </h3>
          
          <div className="space-y-sm">
            <Link 
              href={hasResume ? `/resume/builder/${resume.id}` : "/resume/builder/new"} 
              className="flex items-center gap-md p-sm bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm"
            >
              <div className="w-10 h-10 bg-primary-container/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined">design_services</span>
              </div>
              <div className="flex-1">
                <h4 className="font-label-md font-bold text-on-background">Resume Builder</h4>
                <p className="text-xs text-on-surface-variant">{hasResume ? "Edit your current resume." : "Create a new resume."}</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
            </Link>

            {hasResume && (
              <Link 
                href={`/resume/ats`} 
                className="flex items-center gap-md p-sm bg-secondary-container/10 rounded-xl border border-transparent hover:border-secondary transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 bg-secondary-container/20 rounded-full flex items-center justify-center text-secondary shrink-0 group-hover:bg-secondary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined">fact_check</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-label-md font-bold text-on-background">ATS Score Checker</h4>
                  <p className="text-xs text-on-surface-variant">Check your resume against a job description.</p>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-secondary transition-colors">chevron_right</span>
              </Link>
            )}

            <Link 
              href="/resume/upload" 
              className="flex items-center gap-md p-sm bg-surface-container-lowest rounded-xl border border-transparent hover:border-primary transition-all cursor-pointer group shadow-sm"
            >
              <div className="w-10 h-10 bg-primary-container/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined">upload_file</span>
              </div>
              <div className="flex-1">
                <h4 className="font-label-md font-bold text-on-background">Upload Resume</h4>
                <p className="text-xs text-on-surface-variant">Upload a new PDF to parse and update.</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
