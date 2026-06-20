'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { saveResumeAction } from '../../actions'
import { defaultResumeData } from '@/lib/resume-toolkit/schema/resume/default'
import type { ResumeData, ExperienceItem, EducationItem, SkillItem } from '@/lib/resume-toolkit/schema/resume/data'
import { createId } from '@paralleldrive/cuid2'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with react-pdf
const PdfPreview = dynamic(() => import('./pdf-preview'), { ssr: false })

// ─── helpers ───────────────────────────────────────────────────────────────
function deepMerge(defaults: any, overrides: any): any {
  if (!overrides) return defaults
  if (typeof defaults !== 'object' || defaults === null) return overrides
  if (Array.isArray(defaults)) return overrides
  const result = { ...defaults }
  for (const key in overrides) {
    if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && defaults[key] !== null) {
      result[key] = deepMerge(defaults[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  }
  return result
}

// ─── Section components ────────────────────────────────────────────────────

function SectionHeader({ title, icon, onAdd }: { title: string; icon: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-sm">
      <h2 className="font-bold text-title-md text-on-background flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
        {title}
      </h2>
      <button onClick={onAdd} className="text-sm text-primary flex items-center gap-1 hover:underline">
        <span className="material-symbols-outlined text-[16px]">add</span> Add
      </button>
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-label-sm text-on-surface-variant mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-outline/50 rounded-lg px-3 py-2 text-body-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-label-sm text-on-surface-variant mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-surface border border-outline/50 rounded-lg px-3 py-2 text-body-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none"
      />
    </div>
  )
}

// ─── Main editor ───────────────────────────────────────────────────────────

export function ResumeEditor({
  resumeId,
  initialTitle,
  initialData,
}: {
  resumeId: string
  initialTitle: string
  initialData: any
}) {
  const [title, setTitle] = useState(initialTitle)
  const [data, setData] = useState<ResumeData>(() => deepMerge(defaultResumeData, initialData))
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [activeSection, setActiveSection] = useState('basics')
  const isFirstRender = useRef(true)

  // Auto-save with 2s debounce — skip the very first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timer = setTimeout(async () => {
      setIsSaving(true)
      try {
        await saveResumeAction(resumeId, title, data)
        setLastSaved(new Date())
      } catch (e) {
        console.error('Auto-save failed:', e)
      } finally {
        setIsSaving(false)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [data, title, resumeId])

  // ─── updaters ──────────────────────────────────────────────────────
  const updateBasics = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, basics: { ...prev.basics, [field]: value } }))
  }, [])

  const updateSummary = useCallback((content: string) => {
    setData(prev => ({ ...prev, summary: { ...prev.summary, content } }))
  }, [])

  // Experience
  const addExperience = useCallback(() => {
    const newItem: ExperienceItem = {
      id: createId(), hidden: false, company: '', position: '', location: '',
      period: '', website: { url: '', label: '', inlineLink: false }, description: '', roles: []
    }
    setData(prev => ({
      ...prev, sections: {
        ...prev.sections, experience: {
          ...prev.sections.experience, items: [...prev.sections.experience.items, newItem]
        }
      }
    }))
  }, [])

  const updateExperience = useCallback((index: number, field: string, value: string) => {
    setData(prev => {
      const items = [...prev.sections.experience.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, sections: { ...prev.sections, experience: { ...prev.sections.experience, items } } }
    })
  }, [])

  const removeExperience = useCallback((index: number) => {
    setData(prev => {
      const items = prev.sections.experience.items.filter((_, i) => i !== index)
      return { ...prev, sections: { ...prev.sections, experience: { ...prev.sections.experience, items } } }
    })
  }, [])

  // Education
  const addEducation = useCallback(() => {
    const newItem: EducationItem = {
      id: createId(), hidden: false, school: '', degree: '', area: '', grade: '',
      location: '', period: '', website: { url: '', label: '', inlineLink: false }, description: ''
    }
    setData(prev => ({
      ...prev, sections: {
        ...prev.sections, education: {
          ...prev.sections.education, items: [...prev.sections.education.items, newItem]
        }
      }
    }))
  }, [])

  const updateEducation = useCallback((index: number, field: string, value: string) => {
    setData(prev => {
      const items = [...prev.sections.education.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, sections: { ...prev.sections, education: { ...prev.sections.education, items } } }
    })
  }, [])

  const removeEducation = useCallback((index: number) => {
    setData(prev => {
      const items = prev.sections.education.items.filter((_, i) => i !== index)
      return { ...prev, sections: { ...prev.sections, education: { ...prev.sections.education, items } } }
    })
  }, [])

  // Skills
  const addSkill = useCallback(() => {
    const newItem: SkillItem = {
      id: createId(), hidden: false, icon: '', iconColor: '', name: '', proficiency: '',
      level: 0, keywords: []
    }
    setData(prev => ({
      ...prev, sections: {
        ...prev.sections, skills: {
          ...prev.sections.skills, items: [...prev.sections.skills.items, newItem]
        }
      }
    }))
  }, [])

  const updateSkill = useCallback((index: number, field: string, value: any) => {
    setData(prev => {
      const items = [...prev.sections.skills.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, sections: { ...prev.sections, skills: { ...prev.sections.skills, items } } }
    })
  }, [])

  const removeSkill = useCallback((index: number) => {
    setData(prev => {
      const items = prev.sections.skills.items.filter((_, i) => i !== index)
      return { ...prev, sections: { ...prev.sections, skills: { ...prev.sections.skills, items } } }
    })
  }, [])

  // ─── section tabs ──────────────────────────────────────────────────
  const sections = [
    { id: 'basics', label: 'Personal', icon: 'person' },
    { id: 'summary', label: 'Summary', icon: 'description' },
    { id: 'experience', label: 'Experience', icon: 'work' },
    { id: 'education', label: 'Education', icon: 'school' },
    { id: 'skills', label: 'Skills', icon: 'psychology' },
  ]

  return (
    <div className="flex h-full w-full">
      {/* Editor Panel */}
      <div className="w-1/2 flex flex-col border-r border-outline-variant/50 bg-surface">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30 bg-surface-container-lowest">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-title-lg font-bold bg-transparent border-b-2 border-transparent hover:border-outline-variant focus:border-primary outline-none transition-colors flex-1 mr-4"
            placeholder="Resume Title"
          />
          <div className="text-label-sm text-on-surface-variant flex items-center gap-1.5 shrink-0">
            {isSaving ? (
              <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span> Saving</>
            ) : lastSaved ? (
              <><span className="material-symbols-outlined text-[14px] text-primary">check_circle</span> Saved</>
            ) : (
              <span className="text-outline">Not saved yet</span>
            )}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-outline-variant/30 bg-surface-container-lowest overflow-x-auto">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm transition-all whitespace-nowrap ${
                activeSection === s.id
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSection === 'basics' && (
            <div className="space-y-4">
              <h2 className="font-bold text-title-md text-on-background flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                Personal Information
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Full Name" value={data.basics.name} onChange={v => updateBasics('name', v)} placeholder="John Doe" />
                <InputField label="Headline" value={data.basics.headline} onChange={v => updateBasics('headline', v)} placeholder="Software Engineer" />
                <InputField label="Email" value={data.basics.email} onChange={v => updateBasics('email', v)} placeholder="john@example.com" type="email" />
                <InputField label="Phone" value={data.basics.phone} onChange={v => updateBasics('phone', v)} placeholder="+1 234 567 890" type="tel" />
                <div className="col-span-2">
                  <InputField label="Location" value={data.basics.location} onChange={v => updateBasics('location', v)} placeholder="San Francisco, CA" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'summary' && (
            <div className="space-y-4">
              <h2 className="font-bold text-title-md text-on-background flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                Professional Summary
              </h2>
              <TextAreaField
                label="Summary"
                value={data.summary.content}
                onChange={updateSummary}
                placeholder="Write a brief professional summary highlighting your key achievements and career goals..."
                rows={6}
              />
              <p className="text-xs text-on-surface-variant">Tip: Keep it 2-4 sentences. Focus on your value proposition.</p>
            </div>
          )}

          {activeSection === 'experience' && (
            <div className="space-y-4">
              <SectionHeader title="Work Experience" icon="work" onAdd={addExperience} />
              {data.sections.experience.items.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">work_outline</span>
                  <p>No experience added yet. Click "Add" to get started.</p>
                </div>
              )}
              {data.sections.experience.items.map((exp, i) => (
                <div key={exp.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-label-md font-bold text-on-surface-variant">Experience {i + 1}</span>
                    <button onClick={() => removeExperience(i)} className="text-error text-xs hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Company" value={exp.company} onChange={v => updateExperience(i, 'company', v)} placeholder="Acme Inc." />
                    <InputField label="Position" value={exp.position} onChange={v => updateExperience(i, 'position', v)} placeholder="Software Engineer" />
                    <InputField label="Location" value={exp.location} onChange={v => updateExperience(i, 'location', v)} placeholder="Remote" />
                    <InputField label="Period" value={exp.period} onChange={v => updateExperience(i, 'period', v)} placeholder="Jan 2023 — Present" />
                  </div>
                  <TextAreaField label="Description" value={exp.description} onChange={v => updateExperience(i, 'description', v)} placeholder="Describe your responsibilities and achievements..." />
                </div>
              ))}
            </div>
          )}

          {activeSection === 'education' && (
            <div className="space-y-4">
              <SectionHeader title="Education" icon="school" onAdd={addEducation} />
              {data.sections.education.items.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">school</span>
                  <p>No education added yet. Click "Add" to get started.</p>
                </div>
              )}
              {data.sections.education.items.map((edu, i) => (
                <div key={edu.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-label-md font-bold text-on-surface-variant">Education {i + 1}</span>
                    <button onClick={() => removeEducation(i)} className="text-error text-xs hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="School / Institution" value={edu.school} onChange={v => updateEducation(i, 'school', v)} placeholder="MIT" />
                    <InputField label="Degree" value={edu.degree} onChange={v => updateEducation(i, 'degree', v)} placeholder="B.Tech" />
                    <InputField label="Area of Study" value={edu.area} onChange={v => updateEducation(i, 'area', v)} placeholder="Computer Science" />
                    <InputField label="Grade / GPA" value={edu.grade} onChange={v => updateEducation(i, 'grade', v)} placeholder="3.8 / 4.0" />
                    <InputField label="Location" value={edu.location} onChange={v => updateEducation(i, 'location', v)} placeholder="Cambridge, MA" />
                    <InputField label="Period" value={edu.period} onChange={v => updateEducation(i, 'period', v)} placeholder="Aug 2019 — May 2023" />
                  </div>
                  <TextAreaField label="Description" value={edu.description} onChange={v => updateEducation(i, 'description', v)} placeholder="Activities, coursework, or achievements..." />
                </div>
              ))}
            </div>
          )}

          {activeSection === 'skills' && (
            <div className="space-y-4">
              <SectionHeader title="Skills" icon="psychology" onAdd={addSkill} />
              {data.sections.skills.items.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">construction</span>
                  <p>No skills added yet. Click "Add" to get started.</p>
                </div>
              )}
              {data.sections.skills.items.map((skill, i) => (
                <div key={skill.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-label-md font-bold text-on-surface-variant">Skill {i + 1}</span>
                    <button onClick={() => removeSkill(i)} className="text-error text-xs hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Skill Name" value={skill.name} onChange={v => updateSkill(i, 'name', v)} placeholder="React.js" />
                    <InputField label="Proficiency" value={skill.proficiency} onChange={v => updateSkill(i, 'proficiency', v)} placeholder="Advanced" />
                  </div>
                  <InputField
                    label="Keywords (comma-separated)"
                    value={(skill.keywords || []).join(', ')}
                    onChange={v => updateSkill(i, 'keywords', v.split(',').map(k => k.trim()).filter(Boolean))}
                    placeholder="TypeScript, Next.js, Node.js"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Preview Panel */}
      <div className="w-1/2 bg-surface-container-high flex flex-col">
        <PdfPreview data={data} />
      </div>
    </div>
  )
}
