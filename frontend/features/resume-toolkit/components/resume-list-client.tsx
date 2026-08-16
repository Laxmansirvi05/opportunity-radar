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
  updated_at: string
  parsedResume: ParsedResume | null
}

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

export function ResumeListClient({ initialResumes }: { initialResumes: ResumeRow[] }) {
  const [resumes, setResumes] = useState<ResumeRow[]>(initialResumes)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewResume, setPreviewResume] = useState<ResumeRow | null>(null)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const result = await deleteResume(id)
    if (result.success) {
      setResumes(prev => prev.filter(r => r.id !== id))
    }
    setDeleteConfirmId(null)
    setIsDeleting(false)
  }

  return (
    <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface overflow-hidden">
      {resumes.map((resume) => (
        <div key={resume.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="material-symbols-outlined text-primary shrink-0">description</span>
            <div className="flex-1 min-w-0">
              <Link
                href={`/resume/builder/${resume.id}`}
                className="text-sm font-medium text-on-background hover:text-primary transition-colors truncate block"
              >
                {resume.title}
              </Link>
              <p className="text-xs text-on-surface-variant">
                Edited {formatRelativeTime(resume.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:shrink-0 mt-2 sm:mt-0">
            {/* Preview — scroll through the actual extracted/saved content
                without leaving this page or navigating into the full editor. */}
            {resume.parsedResume && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                title="Preview Resume"
                onClick={() => setPreviewResume(resume)}
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span className="sr-only">Preview</span>
              </Button>
            )}

            {/* Download — a PDF of exactly what was saved, without opening
                the preview modal first. */}
            {resume.parsedResume && (
              <a href={`/api/resume/${resume.id}/download`} title="Download PDF">
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span className="sr-only">Download</span>
                </Button>
              </a>
            )}

            {/* Edit */}
            <Link href={`/resume/builder/${resume.id}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2" title="Edit Resume">
                <span className="material-symbols-outlined text-sm">edit</span>
                <span className="sr-only">Edit</span>
              </Button>
            </Link>

            {/* ATS Check */}
            <Link href={`/resume/ats?resume=${resume.id}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2" title="ATS Check">
                <span className="material-symbols-outlined text-sm">fact_check</span>
                <span className="sr-only">ATS Check</span>
              </Button>
            </Link>

            {/* Optimiser */}
            <Link href={`/resume/copilot?resume=${resume.id}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2" title="Resume Optimiser">
                <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                <span className="sr-only">Resume Optimiser</span>
              </Button>
            </Link>

            {/* Delete */}
            <div className="relative">
              {deleteConfirmId === resume.id ? (
                <div className="absolute right-0 top-0 flex items-center gap-1 bg-surface-container p-1 rounded-md shadow-sm z-10 border border-outline-variant">
                  <span className="text-xs font-medium px-2 whitespace-nowrap text-on-surface-variant">Delete?</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(resume.id)}
                    disabled={isDeleting}
                  >
                    Yes
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={isDeleting}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-on-surface-variant hover:text-destructive transition-colors" 
                  title="Delete"
                  onClick={() => setDeleteConfirmId(resume.id)}
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span className="sr-only">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

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
