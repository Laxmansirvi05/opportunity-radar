'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ResumeData, resumeDataSchema } from '@/src/lib/resume-ai/schema/data'
import { Button } from '@/components/ui/button'
import { saveResumeAction } from '../actions/save-resume'

import { PersonalInfoSection } from './sections/personal-info-section'
import { EducationSection } from './sections/education-section'
import { ExperienceSection } from './sections/experience-section'
import { ProjectsSection } from './sections/projects-section'
import { SkillsSection } from './sections/skills-section'
import { CertificationsSection } from './sections/certifications-section'

interface ResumeReviewFormProps {
  resumeId: string
  initialData: ResumeData
}

export function ResumeReviewForm({ resumeId, initialData }: ResumeReviewFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const methods = useForm<ResumeData>({
    resolver: zodResolver(resumeDataSchema),
    defaultValues: initialData
  })

  const onSubmit = async (data: ResumeData) => {
    setIsSaving(true)
    setError(null)
    
    // Convert string tags to arrays if needed for skills
    // In our simplified UI we bind directly to string array or let zod handle it
    // If z.array(z.string()) fails because it's a comma string, we should map it here
    const processedData = { ...data }
    if (processedData.sections?.skills?.items) {
      processedData.sections.skills.items = processedData.sections.skills.items.map(skill => {
        if (typeof skill.keywords === 'string') {
          return {
            ...skill,
            keywords: (skill.keywords as string).split(',').map(k => k.trim()).filter(k => k.length > 0)
          }
        }
        return skill
      })
    }

    try {
      const result = await saveResumeAction(resumeId, processedData)
      if (result.success) {
        // Redirect to success or resume toolkit
        router.push('/resume')
      } else {
        setError(result.error || 'Failed to save changes.')
      }
    } catch (e) {
      console.error(e)
      setError('An unexpected error occurred.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Review Resume</h2>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded bg-red-100 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-12">
          <section>
            <PersonalInfoSection />
          </section>
          
          <hr />
          <section>
            <EducationSection />
          </section>

          <hr />
          <section>
            <ExperienceSection />
          </section>

          <hr />
          <section>
            <ProjectsSection />
          </section>

          <hr />
          <section>
            <SkillsSection />
          </section>

          <hr />
          <section>
            <CertificationsSection />
          </section>
        </div>

        <div className="flex justify-end pt-8">
          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
