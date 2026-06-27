'use client'

import { useState, useRef, useEffect } from 'react'
import type { ResumeData } from '@/features/resume-toolkit/lib/schema/resume/data'

// ────────────────────────────────────────────────────────
// Live A4 Resume Preview
// Renders the resume data into a visual document preview.
// This is a screen-only representation using HTML/CSS.
// PDF export uses @react-pdf/renderer (Phase 2B).
// ────────────────────────────────────────────────────────

interface ResumePreviewProps {
  data: ResumeData
  scale?: number
}

// A4 dimensions at 96 DPI: 794px × 1123px
const A4_WIDTH = 794
const A4_HEIGHT = 1123

function SectionHeading({ title }: { title: string }) {
  if (!title) return null
  return (
    <div className="border-b border-gray-300 pb-1 mb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--resume-primary, #dc2626)' }}>
        {title}
      </h3>
    </div>
  )
}

function ExperiencePreview({ items }: { items: ResumeData['sections']['experience']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-3">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[10px]">{item.position}</span>
            <span className="text-[8px] text-gray-500">{item.period}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[9px] text-gray-700">{item.company}</span>
            {item.location && <span className="text-[8px] text-gray-500">{item.location}</span>}
          </div>
          {item.description && (
            <p className="text-[8px] text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function EducationPreview({ items }: { items: ResumeData['sections']['education']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[10px]">{item.school}</span>
            <span className="text-[8px] text-gray-500">{item.period}</span>
          </div>
          <div className="text-[9px] text-gray-700">
            {[item.degree, item.area].filter(Boolean).join(' in ')}
            {item.grade && <span className="ml-2 text-gray-500">GPA: {item.grade}</span>}
          </div>
          {item.description && (
            <p className="text-[8px] text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function ProjectsPreview({ items }: { items: ResumeData['sections']['projects']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[10px]">{item.name}</span>
            <span className="text-[8px] text-gray-500">{item.period}</span>
          </div>
          {item.description && (
            <p className="text-[8px] text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function SkillsPreview({ items }: { items: ResumeData['sections']['skills']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id} className="text-[9px]">
          <span className="font-semibold">{item.name}</span>
          {item.keywords.length > 0 && (
            <span className="text-gray-600"> — {item.keywords.join(', ')}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function CertificationsPreview({ items }: { items: ResumeData['sections']['certifications']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[9px]">{item.title}</span>
            <span className="text-[8px] text-gray-500">{item.date}</span>
          </div>
          {item.issuer && <span className="text-[8px] text-gray-600">{item.issuer}</span>}
        </div>
      ))}
    </div>
  )
}

function AwardsPreview({ items }: { items: ResumeData['sections']['awards']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[9px]">{item.title}</span>
            <span className="text-[8px] text-gray-500">{item.date}</span>
          </div>
          {item.awarder && <span className="text-[8px] text-gray-600">{item.awarder}</span>}
        </div>
      ))}
    </div>
  )
}

function LanguagesPreview({ items }: { items: ResumeData['sections']['languages']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {items.filter(i => !i.hidden).map((item) => (
        <span key={item.id} className="text-[9px]">
          <span className="font-semibold">{item.language}</span>
          {item.fluency && <span className="text-gray-600"> ({item.fluency})</span>}
        </span>
      ))}
    </div>
  )
}

function ProfilesPreview({ items }: { items: ResumeData['sections']['profiles']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {items.filter(i => !i.hidden).map((item) => (
        <span key={item.id} className="text-[9px]">
          <span className="font-semibold">{item.network}</span>
          {item.username && <span className="text-gray-600">: {item.username}</span>}
        </span>
      ))}
    </div>
  )
}

function VolunteerPreview({ items }: { items: ResumeData['sections']['volunteer']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[10px]">{item.organization}</span>
            <span className="text-[8px] text-gray-500">{item.period}</span>
          </div>
          {item.description && (
            <p className="text-[8px] text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function ReferencesPreview({ items }: { items: ResumeData['sections']['references']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <span className="font-semibold text-[9px]">{item.name}</span>
          {item.position && <span className="text-[8px] text-gray-600"> — {item.position}</span>}
        </div>
      ))}
    </div>
  )
}

function PublicationsPreview({ items }: { items: ResumeData['sections']['publications']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      {items.filter(i => !i.hidden).map((item) => (
        <div key={item.id}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[9px]">{item.title}</span>
            <span className="text-[8px] text-gray-500">{item.date}</span>
          </div>
          {item.publisher && <span className="text-[8px] text-gray-600">{item.publisher}</span>}
        </div>
      ))}
    </div>
  )
}

function InterestsPreview({ items }: { items: ResumeData['sections']['interests']['items'] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {items.filter(i => !i.hidden).map((item) => (
        <span key={item.id} className="text-[9px] font-medium">{item.name}</span>
      ))}
    </div>
  )
}


// ────────────────────────────────────────────────────────
// Section renderer — dispatches to the correct sub-preview
// ────────────────────────────────────────────────────────
function SectionBlock({ sectionKey, data }: { sectionKey: string; data: ResumeData }) {
  const sections = data.sections
  const section = sections[sectionKey as keyof typeof sections]
  if (!section || section.hidden) return null
  if ('items' in section && section.items.length === 0) return null

  return (
    <div className="mb-3">
      <SectionHeading title={section.title} />
      {sectionKey === 'experience' && <ExperiencePreview items={sections.experience.items} />}
      {sectionKey === 'education' && <EducationPreview items={sections.education.items} />}
      {sectionKey === 'projects' && <ProjectsPreview items={sections.projects.items} />}
      {sectionKey === 'skills' && <SkillsPreview items={sections.skills.items} />}
      {sectionKey === 'certifications' && <CertificationsPreview items={sections.certifications.items} />}
      {sectionKey === 'awards' && <AwardsPreview items={sections.awards.items} />}
      {sectionKey === 'languages' && <LanguagesPreview items={sections.languages.items} />}
      {sectionKey === 'profiles' && <ProfilesPreview items={sections.profiles.items} />}
      {sectionKey === 'volunteer' && <VolunteerPreview items={sections.volunteer.items} />}
      {sectionKey === 'references' && <ReferencesPreview items={sections.references.items} />}
      {sectionKey === 'publications' && <PublicationsPreview items={sections.publications.items} />}
      {sectionKey === 'interests' && <InterestsPreview items={sections.interests.items} />}
    </div>
  )
}


export function ResumePreview({ data }: ResumePreviewProps) {
  const { basics, summary, metadata } = data
  const layout = metadata.layout
  const page = layout.pages[0]

  const [zoomMode, setZoomMode] = useState<'fit-width' | 'fit-page'>('fit-page')
  const [scale, setScale] = useState(0.55)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine which sections go into main vs sidebar
  const mainSections = page?.main ?? []
  const sidebarSections = page?.sidebar ?? []
  const isFullWidth = page?.fullWidth ?? false
  const sidebarWidth = layout.sidebarWidth

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      
      const { width, height } = entry.contentRect
      // Subtract padding (32px * 2) from available width/height
      const availableWidth = Math.max(width - 64, 200)
      const availableHeight = Math.max(height - 64, 200)

      if (zoomMode === 'fit-width') {
        setScale(availableWidth / A4_WIDTH)
      } else {
        // Fit page (fit height or width, whichever is more constrained)
        const scaleByWidth = availableWidth / A4_WIDTH
        const scaleByHeight = availableHeight / A4_HEIGHT
        setScale(Math.min(scaleByWidth, scaleByHeight))
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [zoomMode])

  const hasContent = basics.name || basics.headline || basics.email ||
    summary.content ||
    Object.values(data.sections).some(s => 'items' in s && s.items.length > 0)

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-y-auto overflow-x-hidden flex flex-col items-center p-8">
      {/* Zoom Controls Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface-container-high border border-outline-variant rounded-full px-2 py-1.5 shadow-sm z-10">
        <button 
          onClick={() => setZoomMode('fit-page')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${zoomMode === 'fit-page' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-background'}`}
          title="Fit Page"
        >
          Fit Page
        </button>
        <button 
          onClick={() => setZoomMode('fit-width')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${zoomMode === 'fit-width' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-background'}`}
          title="Fit Width"
        >
          Fit Width
        </button>
      </div>

      <div
        style={{
          width: A4_WIDTH,
          minHeight: A4_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          ['--resume-primary' as string]: metadata.design.colors.primary,
          marginBottom: zoomMode === 'fit-width' ? `${(A4_HEIGHT * scale) - A4_HEIGHT + 64}px` : 0 // Adjust margin to prevent clipping in fit-width scroll
        }}
        className="bg-white shadow-xl border border-gray-200 overflow-hidden shrink-0 transition-transform duration-200 ease-out"
      >
        {!hasContent ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400">
            <span className="material-symbols-outlined text-5xl mb-3">description</span>
            <p className="text-sm">Start editing to see your resume</p>
          </div>
        ) : (
          <div
            style={{
              padding: `${metadata.page.marginY * 2.5}px ${metadata.page.marginX * 2.5}px`,
              fontFamily: metadata.typography.body.fontFamily + ', serif',
              fontSize: metadata.typography.body.fontSize,
              lineHeight: metadata.typography.body.lineHeight,
              color: metadata.design.colors.text,
            }}
          >
            {/* Header: Name + Contact */}
            <div className="text-center mb-4">
              {basics.name && (
                <h1
                  className="font-bold mb-0.5"
                  style={{
                    fontFamily: metadata.typography.heading.fontFamily + ', serif',
                    fontSize: metadata.typography.heading.fontSize * 1.8,
                    color: metadata.design.colors.primary,
                  }}
                >
                  {basics.name}
                </h1>
              )}
              {basics.headline && (
                <p className="text-[10px] text-gray-600 mb-1">{basics.headline}</p>
              )}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[8px] text-gray-500">
                {basics.email && <span>{basics.email}</span>}
                {basics.phone && <span>{basics.phone}</span>}
                {basics.location && <span>{basics.location}</span>}
                {basics.website.url && <span>{basics.website.url}</span>}
              </div>
            </div>

            {/* Summary */}
            {!summary.hidden && summary.content && (
              <div className="mb-3">
                {summary.title && <SectionHeading title={summary.title} />}
                <p className="text-[9px] text-gray-700 leading-relaxed whitespace-pre-wrap">{summary.content}</p>
              </div>
            )}

            {/* Body: Main + Sidebar */}
            <div
              className="flex"
              style={{ gap: `${metadata.page.gapX * 2}px` }}
            >
              {/* Main Column */}
              <div style={{ flex: isFullWidth ? 1 : `0 0 ${100 - sidebarWidth}%` }}>
                {mainSections
                  .filter(key => key !== 'summary' && key !== 'profiles')
                  .map((key) => (
                    <SectionBlock key={key} sectionKey={key} data={data} />
                  ))}
              </div>

              {/* Sidebar Column */}
              {!isFullWidth && sidebarSections.length > 0 && (
                <div
                  style={{ flex: `0 0 ${sidebarWidth}%` }}
                  className="border-l border-gray-200 pl-3"
                >
                  {sidebarSections.map((key) => (
                    <SectionBlock key={key} sectionKey={key} data={data} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
