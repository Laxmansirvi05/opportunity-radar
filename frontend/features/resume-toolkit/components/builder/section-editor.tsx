'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type {
  ResumeData,
  Basics,
  ExperienceItem,
  EducationItem,
  SkillItem,
  ProjectItem,
  CertificationItem,
  AwardItem,
  LanguageItem,
  VolunteerItem,
  ProfileItem,
  InterestItem,
  ReferenceItem,
  PublicationItem,
} from '@/features/resume-toolkit/lib/schema/resume/data'

// ────────────────────────────────────────────────────────
// Field component — a single labeled input
// ────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'tel' | 'url'
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-on-surface-variant">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-on-surface-variant">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Basics Editor
// ────────────────────────────────────────────────────────
function BasicsEditor({
  basics,
  onChange,
}: {
  basics: Basics
  onChange: (basics: Basics) => void
}) {
  const update = (key: keyof Basics, value: unknown) =>
    onChange({ ...basics, [key]: value })

  return (
    <div className="space-y-3">
      <Field label="Full Name" value={basics.name} onChange={(v) => update('name', v)} placeholder="John Doe" />
      <Field label="Headline" value={basics.headline} onChange={(v) => update('headline', v)} placeholder="Software Engineer" />
      <Field label="Email" value={basics.email} onChange={(v) => update('email', v)} placeholder="john@example.com" type="email" />
      <Field label="Phone" value={basics.phone} onChange={(v) => update('phone', v)} placeholder="+1 234 567 890" type="tel" />
      <Field label="Location" value={basics.location} onChange={(v) => update('location', v)} placeholder="San Francisco, CA" />
      <Field
        label="Website URL"
        value={basics.website.url}
        onChange={(v) => update('website', { ...basics.website, url: v })}
        placeholder="https://yoursite.com"
        type="url"
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Summary Editor
// ────────────────────────────────────────────────────────
function SummaryEditor({
  summary,
  onChange,
}: {
  summary: ResumeData['summary']
  onChange: (summary: ResumeData['summary']) => void
}) {
  return (
    <div className="space-y-3">
      <Field label="Section Title" value={summary.title} onChange={(v) => onChange({ ...summary, title: v })} placeholder="Summary" />
      <TextareaField
        label="Content"
        value={summary.content}
        onChange={(v) => onChange({ ...summary, content: v })}
        placeholder="Write a brief professional summary..."
        rows={5}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Generic list-item editor (experience, education, etc.)
// ────────────────────────────────────────────────────────
function ItemListEditor<T extends { id: string }>({
  items,
  onItemsChange,
  createItem,
  renderItem,
  itemLabel,
}: {
  items: T[]
  onItemsChange: (items: T[]) => void
  createItem: () => T
  renderItem: (item: T, onChange: (item: T) => void) => React.ReactNode
  itemLabel: (item: T, index: number) => string
}) {
  const addItem = useCallback(() => {
    onItemsChange([...items, createItem()])
  }, [items, createItem, onItemsChange])

  const updateItem = useCallback(
    (index: number, updated: T) => {
      const next = [...items]
      next[index] = updated
      onItemsChange(next)
    },
    [items, onItemsChange]
  )

  const removeItem = useCallback(
    (index: number) => {
      onItemsChange(items.filter((_, i) => i !== index))
    },
    [items, onItemsChange]
  )

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="rounded-lg border border-outline-variant p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">
              {itemLabel(item, index)}
            </span>
            <button
              onClick={() => removeItem(index)}
              className="material-symbols-outlined text-sm text-on-surface-variant hover:text-destructive transition-colors"
              title="Remove"
            >
              delete
            </button>
          </div>
          {renderItem(item, (updated) => updateItem(index, updated))}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <span className="material-symbols-outlined text-sm mr-1.5">add</span>
        Add Item
      </Button>
    </div>
  )
}

function generateId() {
  return crypto.randomUUID()
}

// ────────────────────────────────────────────────────────
// Experience Editor
// ────────────────────────────────────────────────────────
function ExperienceEditor({
  items,
  onItemsChange,
}: {
  items: ExperienceItem[]
  onItemsChange: (items: ExperienceItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        company: '',
        position: '',
        location: '',
        period: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
        roles: [],
      })}
      itemLabel={(item, i) => item.company || `Experience ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Company" value={item.company} onChange={(v) => onChange({ ...item, company: v })} placeholder="Company Name" />
          <Field label="Position" value={item.position} onChange={(v) => onChange({ ...item, position: v })} placeholder="Software Engineer" />
          <Field label="Location" value={item.location} onChange={(v) => onChange({ ...item, location: v })} placeholder="San Francisco, CA" />
          <Field label="Period" value={item.period} onChange={(v) => onChange({ ...item, period: v })} placeholder="Jan 2023 – Present" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Describe your key achievements..." rows={4} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Education Editor
// ────────────────────────────────────────────────────────
function EducationEditor({
  items,
  onItemsChange,
}: {
  items: EducationItem[]
  onItemsChange: (items: EducationItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        school: '',
        degree: '',
        area: '',
        grade: '',
        location: '',
        period: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.school || `Education ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="School" value={item.school} onChange={(v) => onChange({ ...item, school: v })} placeholder="University Name" />
          <Field label="Degree" value={item.degree} onChange={(v) => onChange({ ...item, degree: v })} placeholder="Bachelor of Science" />
          <Field label="Field of Study" value={item.area} onChange={(v) => onChange({ ...item, area: v })} placeholder="Computer Science" />
          <Field label="Grade" value={item.grade} onChange={(v) => onChange({ ...item, grade: v })} placeholder="3.8 / 4.0" />
          <Field label="Location" value={item.location} onChange={(v) => onChange({ ...item, location: v })} placeholder="Cambridge, MA" />
          <Field label="Period" value={item.period} onChange={(v) => onChange({ ...item, period: v })} placeholder="2019 – 2023" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Notable courses, activities..." rows={3} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Skills Editor
// ────────────────────────────────────────────────────────
function SkillsEditor({
  items,
  onItemsChange,
}: {
  items: SkillItem[]
  onItemsChange: (items: SkillItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        icon: '',
        iconColor: '',
        name: '',
        proficiency: '',
        level: 0,
        keywords: [],
      })}
      itemLabel={(item, i) => item.name || `Skill ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Skill Name" value={item.name} onChange={(v) => onChange({ ...item, name: v })} placeholder="React" />
          <Field label="Proficiency" value={item.proficiency} onChange={(v) => onChange({ ...item, proficiency: v })} placeholder="Advanced" />
          <Field
            label="Keywords (comma-separated)"
            value={item.keywords.join(', ')}
            onChange={(v) => onChange({ ...item, keywords: v.split(',').map(k => k.trim()).filter(Boolean) })}
            placeholder="hooks, context, next.js"
          />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Projects Editor
// ────────────────────────────────────────────────────────
function ProjectsEditor({
  items,
  onItemsChange,
}: {
  items: ProjectItem[]
  onItemsChange: (items: ProjectItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        name: '',
        period: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.name || `Project ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Project Name" value={item.name} onChange={(v) => onChange({ ...item, name: v })} placeholder="My Project" />
          <Field label="Period" value={item.period} onChange={(v) => onChange({ ...item, period: v })} placeholder="2024" />
          <Field label="Link" value={item.website.url} onChange={(v) => onChange({ ...item, website: { ...item.website, url: v } })} placeholder="https://github.com/..." type="url" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Describe the project..." rows={4} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Certifications Editor
// ────────────────────────────────────────────────────────
function CertificationsEditor({
  items,
  onItemsChange,
}: {
  items: CertificationItem[]
  onItemsChange: (items: CertificationItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        title: '',
        issuer: '',
        date: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.title || `Certification ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Certification" value={item.title} onChange={(v) => onChange({ ...item, title: v })} placeholder="AWS Solutions Architect" />
          <Field label="Issuer" value={item.issuer} onChange={(v) => onChange({ ...item, issuer: v })} placeholder="Amazon Web Services" />
          <Field label="Date" value={item.date} onChange={(v) => onChange({ ...item, date: v })} placeholder="March 2024" />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Awards Editor
// ────────────────────────────────────────────────────────
function AwardsEditor({
  items,
  onItemsChange,
}: {
  items: AwardItem[]
  onItemsChange: (items: AwardItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        title: '',
        awarder: '',
        date: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.title || `Award ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Title" value={item.title} onChange={(v) => onChange({ ...item, title: v })} placeholder="Best Paper Award" />
          <Field label="Awarder" value={item.awarder} onChange={(v) => onChange({ ...item, awarder: v })} placeholder="IEEE" />
          <Field label="Date" value={item.date} onChange={(v) => onChange({ ...item, date: v })} placeholder="2024" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Award details..." rows={2} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Languages Editor
// ────────────────────────────────────────────────────────
function LanguagesEditor({
  items,
  onItemsChange,
}: {
  items: LanguageItem[]
  onItemsChange: (items: LanguageItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        language: '',
        fluency: '',
        level: 0,
      })}
      itemLabel={(item, i) => item.language || `Language ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Language" value={item.language} onChange={(v) => onChange({ ...item, language: v })} placeholder="English" />
          <Field label="Fluency" value={item.fluency} onChange={(v) => onChange({ ...item, fluency: v })} placeholder="Native / Fluent / B2" />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Profiles Editor
// ────────────────────────────────────────────────────────
function ProfilesEditor({
  items,
  onItemsChange,
}: {
  items: ProfileItem[]
  onItemsChange: (items: ProfileItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        icon: '',
        iconColor: '',
        network: '',
        username: '',
        website: { url: '', label: '', inlineLink: false },
      })}
      itemLabel={(item, i) => item.network || `Profile ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Network" value={item.network} onChange={(v) => onChange({ ...item, network: v })} placeholder="LinkedIn" />
          <Field label="Username" value={item.username} onChange={(v) => onChange({ ...item, username: v })} placeholder="johndoe" />
          <Field label="URL" value={item.website.url} onChange={(v) => onChange({ ...item, website: { ...item.website, url: v } })} placeholder="https://linkedin.com/in/johndoe" type="url" />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Interests Editor
// ────────────────────────────────────────────────────────
function InterestsEditor({
  items,
  onItemsChange,
}: {
  items: InterestItem[]
  onItemsChange: (items: InterestItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        icon: '',
        iconColor: '',
        name: '',
        keywords: [],
      })}
      itemLabel={(item, i) => item.name || `Interest ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Name" value={item.name} onChange={(v) => onChange({ ...item, name: v })} placeholder="Open Source" />
          <Field
            label="Keywords (comma-separated)"
            value={item.keywords.join(', ')}
            onChange={(v) => onChange({ ...item, keywords: v.split(',').map(k => k.trim()).filter(Boolean) })}
            placeholder="linux, git, collaboration"
          />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// References Editor
// ────────────────────────────────────────────────────────
function ReferencesEditor({
  items,
  onItemsChange,
}: {
  items: ReferenceItem[]
  onItemsChange: (items: ReferenceItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        name: '',
        position: '',
        website: { url: '', label: '', inlineLink: false },
        phone: '',
        description: '',
      })}
      itemLabel={(item, i) => item.name || `Reference ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Name" value={item.name} onChange={(v) => onChange({ ...item, name: v })} placeholder="Jane Smith" />
          <Field label="Position" value={item.position} onChange={(v) => onChange({ ...item, position: v })} placeholder="Engineering Manager at Google" />
          <Field label="Phone" value={item.phone} onChange={(v) => onChange({ ...item, phone: v })} placeholder="+1 234 567 890" type="tel" />
          <TextareaField label="Testimonial" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="A brief testimonial or note..." rows={2} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Volunteer Editor
// ────────────────────────────────────────────────────────
function VolunteerEditor({
  items,
  onItemsChange,
}: {
  items: VolunteerItem[]
  onItemsChange: (items: VolunteerItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        organization: '',
        location: '',
        period: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.organization || `Volunteer ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Organization" value={item.organization} onChange={(v) => onChange({ ...item, organization: v })} placeholder="Red Cross" />
          <Field label="Location" value={item.location} onChange={(v) => onChange({ ...item, location: v })} placeholder="New York, NY" />
          <Field label="Period" value={item.period} onChange={(v) => onChange({ ...item, period: v })} placeholder="2023 – Present" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Your contributions..." rows={3} />
        </div>
      )}
    />
  )
}

// ────────────────────────────────────────────────────────
// Publications Editor
// ────────────────────────────────────────────────────────
function PublicationsEditor({
  items,
  onItemsChange,
}: {
  items: PublicationItem[]
  onItemsChange: (items: PublicationItem[]) => void
}) {
  return (
    <ItemListEditor
      items={items}
      onItemsChange={onItemsChange}
      createItem={() => ({
        id: generateId(),
        hidden: false,
        title: '',
        publisher: '',
        date: '',
        website: { url: '', label: '', inlineLink: false },
        description: '',
      })}
      itemLabel={(item, i) => item.title || `Publication ${i + 1}`}
      renderItem={(item, onChange) => (
        <div className="space-y-3">
          <Field label="Title" value={item.title} onChange={(v) => onChange({ ...item, title: v })} placeholder="My Research Paper" />
          <Field label="Publisher" value={item.publisher} onChange={(v) => onChange({ ...item, publisher: v })} placeholder="IEEE / ACM / Nature" />
          <Field label="Date" value={item.date} onChange={(v) => onChange({ ...item, date: v })} placeholder="2024" />
          <TextareaField label="Description" value={item.description} onChange={(v) => onChange({ ...item, description: v })} placeholder="Abstract or notes..." rows={2} />
        </div>
      )}
    />
  )
}


// ────────────────────────────────────────────────────────
// Section configuration and master dispatch
// ────────────────────────────────────────────────────────
export const SECTION_CONFIG = [
  { key: 'basics', label: 'Basics', icon: 'person' },
  { key: 'summary', label: 'Summary', icon: 'subject' },
  { key: 'profiles', label: 'Profiles', icon: 'share' },
  { key: 'experience', label: 'Experience', icon: 'work' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'skills', label: 'Skills', icon: 'psychology' },
  { key: 'projects', label: 'Projects', icon: 'code' },
  { key: 'certifications', label: 'Certifications', icon: 'verified' },
  { key: 'awards', label: 'Awards', icon: 'emoji_events' },
  { key: 'languages', label: 'Languages', icon: 'translate' },
  { key: 'interests', label: 'Interests', icon: 'interests' },
  { key: 'volunteer', label: 'Volunteer', icon: 'volunteer_activism' },
  { key: 'references', label: 'References', icon: 'contact_page' },
  { key: 'publications', label: 'Publications', icon: 'menu_book' },
] as const

export type SectionKey = (typeof SECTION_CONFIG)[number]['key']

interface SectionEditorProps {
  sectionKey: SectionKey
  resumeData: ResumeData
  onUpdateSection: <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => void
  onUpdateSectionItems: (sectionKey: string, items: unknown[]) => void
}

export function SectionEditor({
  sectionKey,
  resumeData,
  onUpdateSection,
  onUpdateSectionItems,
}: SectionEditorProps) {
  switch (sectionKey) {
    case 'basics':
      return <BasicsEditor basics={resumeData.basics} onChange={(b) => onUpdateSection('basics', b)} />
    case 'summary':
      return <SummaryEditor summary={resumeData.summary} onChange={(s) => onUpdateSection('summary', s)} />
    case 'profiles':
      return <ProfilesEditor items={resumeData.sections.profiles.items} onItemsChange={(items) => onUpdateSectionItems('profiles', items)} />
    case 'experience':
      return <ExperienceEditor items={resumeData.sections.experience.items} onItemsChange={(items) => onUpdateSectionItems('experience', items)} />
    case 'education':
      return <EducationEditor items={resumeData.sections.education.items} onItemsChange={(items) => onUpdateSectionItems('education', items)} />
    case 'skills':
      return <SkillsEditor items={resumeData.sections.skills.items} onItemsChange={(items) => onUpdateSectionItems('skills', items)} />
    case 'projects':
      return <ProjectsEditor items={resumeData.sections.projects.items} onItemsChange={(items) => onUpdateSectionItems('projects', items)} />
    case 'certifications':
      return <CertificationsEditor items={resumeData.sections.certifications.items} onItemsChange={(items) => onUpdateSectionItems('certifications', items)} />
    case 'awards':
      return <AwardsEditor items={resumeData.sections.awards.items} onItemsChange={(items) => onUpdateSectionItems('awards', items)} />
    case 'languages':
      return <LanguagesEditor items={resumeData.sections.languages.items} onItemsChange={(items) => onUpdateSectionItems('languages', items)} />
    case 'interests':
      return <InterestsEditor items={resumeData.sections.interests.items} onItemsChange={(items) => onUpdateSectionItems('interests', items)} />
    case 'volunteer':
      return <VolunteerEditor items={resumeData.sections.volunteer.items} onItemsChange={(items) => onUpdateSectionItems('volunteer', items)} />
    case 'references':
      return <ReferencesEditor items={resumeData.sections.references.items} onItemsChange={(items) => onUpdateSectionItems('references', items)} />
    case 'publications':
      return <PublicationsEditor items={resumeData.sections.publications.items} onItemsChange={(items) => onUpdateSectionItems('publications', items)} />
    default:
      return null
  }
}
