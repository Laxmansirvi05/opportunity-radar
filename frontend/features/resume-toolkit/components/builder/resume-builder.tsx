'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useResume } from '@/features/resume-toolkit/hooks/use-resume'
import { SectionsPanel } from './sections-panel'
import { SectionEditor, SECTION_CONFIG, type SectionKey } from './section-editor'
import { ResumePreview } from './resume-preview'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ResumeData } from '@/features/resume-toolkit/lib/schema/resume/data'

interface ResumeBuilderProps {
  slug?: string
  initialData?: ResumeData
  initialTitle?: string
  initialId?: string
}

export function ResumeBuilder({ slug, initialData, initialTitle, initialId }: ResumeBuilderProps) {
  const {
    resumeData,
    title,
    updateTitle,
    saveStatus,
    loading,
    save,
    updateSection,
    updateSectionItems,
  } = useResume({ slug, initialData, initialTitle, initialId })

  const [activeSection, setActiveSection] = useState<SectionKey>('basics')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Mobile view mode
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')

  /**
   * The PDF is rendered server-side from the saved `resumes.parsed_data` row,
   * so any pending edits are flushed first — otherwise the file would silently
   * miss whatever was typed inside the 2s autosave debounce, and a resume that
   * had never been saved would have no row to render at all.
   *
   * The rest of the toolkit downloads through a plain `<a href>`, which can't
   * express that save-then-fetch ordering (or surface a failure), so this one
   * goes through fetch and a blob.
   */
  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true)
    try {
      const id = await save()
      if (!id) {
        toast.error("Couldn't save your resume, so the PDF wasn't created.")
        return
      }

      const response = await fetch(`/api/resume/${id}/download`)
      if (!response.ok) {
        toast.error("Couldn't create the PDF. Please try again.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Name the file after the resume the user named, not the generic
      // server-side fallback; same sanitising the download route applies.
      const safeName =
        title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'
      link.download = `${safeName}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Couldn't create the PDF. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }, [save, title])

  // Compute section item counts for the left panel badges
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const config of SECTION_CONFIG) {
      if (config.key === 'basics') {
        const b = resumeData.basics
        counts[config.key] = [b.name, b.email, b.phone, b.location, b.headline].filter(Boolean).length
      } else if (config.key === 'summary') {
        counts[config.key] = resumeData.summary.content ? 1 : 0
      } else {
        const section = resumeData.sections[config.key as keyof typeof resumeData.sections]
        if (section && 'items' in section) {
          counts[config.key] = section.items.length
        }
      }
    }
    return counts
  }, [resumeData])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl animate-pulse">description</span>
          <p className="text-sm">Loading resume...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-outline-variant bg-surface shrink-0 min-h-[56px]">
        {/* Left Side: Back, Name, Save Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href="/resume"
            className="flex items-center justify-center h-8 w-8 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shrink-0"
            title="Back to Toolkit Home"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>

          <div className="h-5 w-px bg-outline-variant shrink-0" />

          {/* Editable title */}
          <div className="flex items-center gap-2 min-w-0 max-w-[200px] sm:max-w-xs">
            {isEditingTitle ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => updateTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false)
                }}
                className="w-full text-sm font-semibold text-on-background bg-transparent border-b border-primary outline-none px-1 py-0.5"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1.5 min-w-0 text-sm font-semibold text-on-background hover:text-primary transition-colors truncate"
                title="Click to rename"
              >
                <span className="truncate">{title || 'Untitled Resume'}</span>
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">edit</span>
              </button>
            )}
          </div>

          {/* Save status & Manual Save */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              'text-[11px] font-medium tracking-wide uppercase flex items-center gap-1 hidden sm:flex',
              saveStatus === 'saving' && 'text-on-surface-variant',
              saveStatus === 'saved' && 'text-success',
              saveStatus === 'error' && 'text-destructive',
              saveStatus === 'idle' && 'text-on-surface-variant',
            )}>
              {saveStatus === 'saving' && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
              {saveStatus === 'saved' && <span className="material-symbols-outlined text-[14px]">cloud_done</span>}
              {saveStatus === 'error' && <span className="material-symbols-outlined text-[14px]">error</span>}
              {saveStatus === 'idle' && <span className="material-symbols-outlined text-[14px]">cloud_off</span>}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-on-surface-variant hidden md:flex"
              onClick={() => save()}
              title="Save Now"
            >
              <span className="material-symbols-outlined text-sm">save</span>
            </Button>
          </div>
        </div>

        {/* Right Side: Tools & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-surface-container-low rounded-md p-0.5 border border-outline-variant mr-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-on-surface-variant" disabled title="Undo (Coming Soon)">
              <span className="material-symbols-outlined text-sm">undo</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-on-surface-variant" disabled title="Redo (Coming Soon)">
              <span className="material-symbols-outlined text-sm">redo</span>
            </Button>
          </div>
          
          <Button variant="outline" size="sm" className="h-8 hidden md:flex" disabled title="Preview Mode (Coming Soon)">
            <span className="material-symbols-outlined text-sm mr-1.5">visibility</span>
            Preview Mode
          </Button>

          <Button
            variant="default"
            size="sm"
            className="h-8"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            title="Download PDF"
          >
            <span
              className={cn(
                'material-symbols-outlined text-sm mr-1.5',
                isDownloading && 'animate-spin'
              )}
            >
              {isDownloading ? 'progress_activity' : 'picture_as_pdf'}
            </span>
            {isDownloading ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* ─── Mobile Tab Switcher (< md) ─── */}
      <div className="flex md:hidden border-b border-outline-variant bg-surface shrink-0">
        <button
          onClick={() => setMobileView('edit')}
          className={cn(
            'flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors',
            mobileView === 'edit'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant'
          )}
        >
          Edit
        </button>
        <button
          onClick={() => setMobileView('preview')}
          className={cn(
            'flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors',
            mobileView === 'preview'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant'
          )}
        >
          Preview
        </button>
      </div>

      {/* ─── Three-Panel Layout ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Left Panel (Sections) */}
        <aside className={cn(
          'w-56 shrink-0 border-r border-outline-variant bg-surface overflow-hidden flex-col',
          mobileView === 'preview' ? 'hidden md:flex' : 'hidden sm:flex'
        )}>
          <SectionsPanel
            activeSection={activeSection}
            onSectionSelect={setActiveSection}
            sectionCounts={sectionCounts}
          />
        </aside>

        {/* Mobile Section Selector (small screens only) */}
        {mobileView === 'edit' && (
          <div className="sm:hidden border-b border-outline-variant overflow-x-auto bg-surface shrink-0 absolute top-[104px] left-0 right-0 z-10">
            {/* Inline below */}
          </div>
        )}

        {/* 2. Center Panel (Editor + Preview) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Editor Column */}
          <div className={cn(
            'w-full md:w-[350px] lg:w-[400px] xl:w-[450px] overflow-y-auto shrink-0 bg-surface flex flex-col',
            mobileView === 'preview' && 'hidden md:flex'
          )}>
            <div className="sm:hidden overflow-x-auto border-b border-outline-variant bg-surface px-2 py-1.5 flex gap-1 shrink-0">
              {SECTION_CONFIG.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={cn(
                    'shrink-0 px-2.5 py-1 text-xs rounded-full transition-colors',
                    activeSection === s.key
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="p-4 md:p-6 flex-1 max-w-[600px] mx-auto w-full">
              <h3 className="text-lg font-semibold text-on-background mb-4">
                {SECTION_CONFIG.find(s => s.key === activeSection)?.label}
              </h3>
              <SectionEditor
                sectionKey={activeSection}
                resumeData={resumeData}
                onUpdateSection={updateSection}
                onUpdateSectionItems={updateSectionItems}
              />
            </div>
          </div>

          {/* Preview Column */}
          <div className={cn(
            'flex-1 bg-surface-container-low overflow-y-auto border-l border-outline-variant relative flex items-start justify-center p-4 lg:p-8',
            mobileView === 'edit' ? 'hidden md:flex' : 'flex'
          )}>
            <ResumePreview data={resumeData} />
          </div>
        </div>

      </div>
    </div>
  )
}
