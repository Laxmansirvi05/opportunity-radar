'use client'

import { ResumeBuilder } from '@/features/resume-toolkit/components/builder/resume-builder'
import { defaultResumeData } from '@/features/resume-toolkit/lib/schema/resume/default'

export default function NewResumePage() {
  // Provide sensible defaults for section titles
  const initialData = {
    ...defaultResumeData,
    summary: { ...defaultResumeData.summary, title: 'Summary' },
    sections: {
      ...defaultResumeData.sections,
      profiles: { ...defaultResumeData.sections.profiles, title: 'Profiles' },
      experience: { ...defaultResumeData.sections.experience, title: 'Experience' },
      education: { ...defaultResumeData.sections.education, title: 'Education' },
      skills: { ...defaultResumeData.sections.skills, title: 'Skills' },
      projects: { ...defaultResumeData.sections.projects, title: 'Projects' },
      certifications: { ...defaultResumeData.sections.certifications, title: 'Certifications' },
      awards: { ...defaultResumeData.sections.awards, title: 'Awards' },
      languages: { ...defaultResumeData.sections.languages, title: 'Languages' },
      interests: { ...defaultResumeData.sections.interests, title: 'Interests' },
      volunteer: { ...defaultResumeData.sections.volunteer, title: 'Volunteer' },
      references: { ...defaultResumeData.sections.references, title: 'References' },
      publications: { ...defaultResumeData.sections.publications, title: 'Publications' },
    },
  }

  return <ResumeBuilder initialData={initialData} initialTitle="Untitled Resume" />
}
