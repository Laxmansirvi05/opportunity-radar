"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Eye, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ParsedResume } from "@/types/resume"

/** Renders a ParsedResume as an actual resume layout — used both in the full
 *  preview modal and (scaled down) as the on-screen glimpse. Same component
 *  either way so the glimpse is never a stylized stand-in for what download
 *  actually produces. */
function ResumeDocument({ resume }: { resume: ParsedResume }) {
  return (
    <div className="bg-white text-neutral-900 text-[13px] leading-snug">
      <div className="border-b border-neutral-200 pb-3 mb-4">
        <h1 className="text-xl font-bold tracking-tight">{resume.name}</h1>
        <p className="text-neutral-600 mt-0.5 text-[12px]">
          {[resume.email, resume.phone, resume.linkedin, resume.github].filter(Boolean).join("  ·  ")}
        </p>
      </div>

      {resume.summary && (
        <section className="mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Summary</h2>
          <p className="text-neutral-800">{resume.summary}</p>
        </section>
      )}

      {resume.experience && resume.experience.length > 0 && (
        <section className="mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Experience</h2>
          <div className="space-y-3">
            {resume.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-semibold">{exp.role} · {exp.company}</span>
                  <span className="text-neutral-500 text-[11px] whitespace-nowrap">
                    {exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : " – Present"}
                  </span>
                </div>
                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="list-disc list-outside ml-4 mt-0.5 space-y-0.5 text-neutral-800">
                    {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <section className="mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Projects</h2>
          <div className="space-y-2">
            {resume.projects.map((p, i) => (
              <div key={i}>
                <span className="font-semibold">{p.name}</span>
                {p.technologies && p.technologies.length > 0 && (
                  <span className="text-neutral-500 text-[11px]"> — {p.technologies.join(", ")}</span>
                )}
                {p.description && <p className="text-neutral-800 mt-0.5">{p.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.education && resume.education.length > 0 && (
        <section className="mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Education</h2>
          <div className="space-y-1.5">
            {resume.education.map((ed, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-semibold">{ed.institution} — {ed.degree}{ed.field ? `, ${ed.field}` : ""}</span>
                {ed.graduation_year && <span className="text-neutral-500 text-[11px] whitespace-nowrap">{ed.graduation_year}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.skills && resume.skills.length > 0 && (
        <section className="mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Skills</h2>
          <p className="text-neutral-800">{resume.skills.join(" · ")}</p>
        </section>
      )}

      {resume.certifications && resume.certifications.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Certifications</h2>
          <p className="text-neutral-800">{resume.certifications.join(" · ")}</p>
        </section>
      )}
    </div>
  )
}

/** Exported directly so other surfaces (e.g. the saved-resumes list) can open
 *  the same scrollable preview without going through ResumeMiniPreview's own
 *  card+button trigger, which is styled for the Optimiser results layout
 *  specifically. */
export function ResumePreviewModal({ resume, label, downloadHref, onClose }: {
  resume: ParsedResume
  label: string
  downloadHref: string | null
  onClose: () => void
}) {
  return <PreviewModal resume={resume} label={label} downloadHref={downloadHref} onClose={onClose} />
}

function PreviewModal({ resume, label, downloadHref, onClose }: {
  resume: ParsedResume
  label: string
  downloadHref: string | null
  onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = "unset"
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden border border-border/80">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <p className="font-semibold text-sm">{label}</p>
          <div className="flex items-center gap-2">
            {downloadHref && (
              <a href={downloadHref}>
                <Button size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
              </a>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6 bg-neutral-100 dark:bg-neutral-900">
          <div className="bg-white rounded-lg shadow-sm p-6 mx-auto max-w-xl">
            <ResumeDocument resume={resume} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The glimpse shown inline on the results card, plus the full-preview modal
 *  it opens into. Reads only data already present on the run — no extra
 *  fetch. */
export function ResumeMiniPreview({ resume, label, downloadHref }: {
  resume: ParsedResume
  label: string
  downloadHref: string | null
}) {
  const [open, setOpen] = useState(false)
  const topSkills = (resume.skills ?? []).slice(0, 4)

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full text-left rounded-lg border border-border/80 bg-white dark:bg-neutral-950 p-3 transition-shadow hover:shadow-sm cursor-pointer"
        )}
      >
        <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">{resume.name}</p>
        {resume.summary && (
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2 leading-snug">{resume.summary}</p>
        )}
        {topSkills.length > 0 && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 truncate">{topSkills.join(" · ")}</p>
        )}
      </button>
      <div className="flex items-center gap-2 mt-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(true)}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />Preview
        </Button>
        {downloadHref && (
          <a href={downloadHref} className="flex-1">
            <Button size="sm" className="w-full"><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
          </a>
        )}
      </div>
      {open && <PreviewModal resume={resume} label={label} downloadHref={downloadHref} onClose={() => setOpen(false)} />}
    </div>
  )
}
