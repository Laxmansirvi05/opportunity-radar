'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteResume } from '@/features/resume-toolkit/services/resume-actions'
import { ResumePreviewModal } from '@/features/resume-toolkit/components/optimizer/resume-preview'
import type { ParsedResume } from '@/types/resume'

interface ResumeRow {
  id: string
  title: string
  slug: string
  created_at: string
  updated_at: string
  parsedResume: ParsedResume | null
}

/**
 * Two rows fit before the list starts scrolling. The window grows when a
 * resume is expanded so its details aren't read through a 130px slot —
 * without that, opening one turns the whole list into a scrollbar.
 */
const COLLAPSED_MAX_HEIGHT = 132
const EXPANDED_MAX_HEIGHT = 440

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** One labelled action. Icons alone are what made the old row unreadable. */
function ActionLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}>
      <Button variant="outline" size="sm" className="h-9 gap-2 px-3.5 text-[13px] font-semibold">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        {label}
      </Button>
    </Link>
  )
}

export function ResumeListClient({ initialResumes }: { initialResumes: ResumeRow[] }) {
  const [resumes, setResumes] = useState<ResumeRow[]>(initialResumes)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewResume, setPreviewResume] = useState<ResumeRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const result = await deleteResume(id)
    if (result.success) {
      setResumes(prev => prev.filter(r => r.id !== id))
      if (expandedId === id) setExpandedId(null)
    }
    setDeleteConfirmId(null)
    setIsDeleting(false)
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">

      {/* Column headings — turn a pile of icons into something readable */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-surface-container-low border-b border-outline-variant">
        <div className="w-9 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          Resume
        </div>
        <div className="hidden sm:block w-32 shrink-0 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          Last edited
        </div>
        <div className="w-6 shrink-0" aria-hidden="true" />
      </div>

      <div
        className="divide-y divide-outline-variant overflow-y-auto transition-[max-height] duration-200 ease-out"
        style={{ maxHeight: expandedId ? EXPANDED_MAX_HEIGHT : COLLAPSED_MAX_HEIGHT }}
      >
        {resumes.map((resume) => {
          const isExpanded = expandedId === resume.id
          return (
            <div key={resume.id}>
              {/* The row: the resume's own name first, and nothing competing
                  with it. Everything else moved into the panel below. */}
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-container ${isExpanded ? 'bg-surface-container-low' : ''}`}
              >
                <span className="w-9 h-9 shrink-0 rounded-lg bg-primary-container/60 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">description</span>
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-on-background truncate">
                    {resume.title}
                  </span>
                  <span className="block sm:hidden text-xs text-on-surface-variant">
                    Edited {formatRelativeTime(resume.updated_at)}
                  </span>
                </span>

                <span className="hidden sm:block w-32 shrink-0 text-[13px] text-on-surface-variant">
                  {formatRelativeTime(resume.updated_at)}
                </span>

                <span
                  className={`w-6 shrink-0 flex justify-end text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </span>
              </button>

              {/* Details + every action spelled out in words */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 sm:pl-[68px] bg-surface-container-low border-t border-outline-variant flex flex-col gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Created</span>
                      <span className="text-[13px] text-on-background">{formatFullDate(resume.created_at)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Last edited</span>
                      <span className="text-[13px] text-on-background">{formatFullDate(resume.updated_at)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Status</span>
                      <span className="text-[13px] text-on-background">
                        {resume.parsedResume ? 'Ready to preview & download' : 'Not parsed yet'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Preview — scroll through the actual extracted/saved
                        content without leaving this page. */}
                    {resume.parsedResume && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 px-3.5 text-[13px] font-semibold"
                        onClick={() => setPreviewResume(resume)}
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Preview
                      </Button>
                    )}

                    {/* Download — a PDF of exactly what was saved. */}
                    {resume.parsedResume && (
                      <a href={`/api/resume/${resume.id}/download`}>
                        <Button size="sm" className="h-9 gap-2 px-3.5 text-[13px] font-semibold">
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Download PDF
                        </Button>
                      </a>
                    )}

                    <ActionLink href={`/resume/builder/${resume.id}`} icon="edit" label="Edit" />
                    <ActionLink href={`/resume/ats?resume=${resume.id}`} icon="fact_check" label="ATS check" />
                    <ActionLink href={`/resume/copilot?resume=${resume.id}`} icon="auto_fix_high" label="Optimise" />

                    <div className="grow" />

                    {deleteConfirmId === resume.id ? (
                      <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface p-1">
                        <span className="px-2 text-xs font-medium text-on-surface-variant whitespace-nowrap">Delete?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(resume.id)}
                          disabled={isDeleting}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={isDeleting}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 px-3.5 text-[13px] font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmId(resume.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Only shown when the list actually scrolls, so it never claims
          there is more when there isn't. */}
      {resumes.length > 2 && (
        <div className="px-4 py-2 border-t border-outline-variant bg-surface-container-low text-[12px] text-on-surface-variant">
          Showing 2 of {resumes.length} — scroll for more
        </div>
      )}

      {previewResume?.parsedResume && (
        <ResumePreviewModal
          resume={previewResume.parsedResume}
          label={previewResume.title}
          downloadHref={`/api/resume/${previewResume.id}/download`}
          onClose={() => setPreviewResume(null)}
        />
      )}
    </div>
  )
}
