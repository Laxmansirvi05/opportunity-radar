'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export interface InterviewHistoryRow {
  id: string
  role_title: string | null
  company: string | null
  status: string
  duration_seconds: number | null
  created_at: string
  /** 0–5 as stored; rendered out of 100 to match the report's own gauge. */
  overall_score: number | null
  degraded: boolean
}

/**
 * Status is shown as a pill rather than coloured text: at a glance the old
 * list read as nine near-identical rows, because the only thing separating a
 * completed interview from an abandoned one was the colour of one word.
 */
const STATUS: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container' },
  in_progress: { label: 'In progress', className: 'bg-primary-container text-on-primary-container' },
  pending: { label: 'Starting', className: 'bg-surface-container text-on-surface-variant' },
  failed: { label: 'Failed', className: 'bg-error/10 text-error' },
  abandoned: { label: 'Abandoned', className: 'bg-surface-container text-on-surface-variant' },
}

/** Bands match the ATS checker's, so a score reads the same across the app. */
function scoreStyle(percent: number): string {
  if (percent >= 78) return 'bg-secondary-container text-on-secondary-container'
  if (percent >= 65) return 'bg-primary-container text-on-primary-container'
  if (percent >= 50) return 'bg-tertiary-container text-on-tertiary-container'
  return 'bg-error/10 text-error'
}

function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(5, score)) * 20)
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InterviewHistoryList({ sessions }: { sessions: InterviewHistoryRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(sessions)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const response = await fetch(`/api/interview/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error?.message ?? 'Could not delete this interview.')
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success('Interview deleted')
      // The count in the page header is rendered on the server.
      router.refresh()
    } catch {
      toast.error('Could not delete this interview. Please check your connection.')
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-12 text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">mic</span>
        <p className="text-base font-semibold text-on-surface mt-3">No interviews yet</p>
        <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
          Practice with a realistic voice interview and get scored feedback on your performance.
        </p>
        <Link
          href="/interview"
          className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Start your first interview
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden divide-y divide-outline-variant">
      {rows.map((session) => {
        const status = STATUS[session.status] ?? STATUS.pending
        const percent = typeof session.overall_score === 'number' ? toPercent(session.overall_score) : null
        const duration = formatDuration(session.duration_seconds)
        const isConfirming = confirmingId === session.id
        const isDeleting = deletingId === session.id

        return (
          <div
            key={session.id}
            className="relative flex items-center gap-4 px-5 py-4 hover:bg-surface-container-low transition-colors"
          >
            {/* Score, or why there isn't one. A number with no unit next to a
                clock icon was the least legible part of the old row. */}
            <div className="shrink-0">
              {percent !== null ? (
                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${scoreStyle(percent)}`}>
                  <span className="text-lg font-bold leading-none">{percent}</span>
                  <span className="text-[10px] font-semibold opacity-70 leading-none mt-0.5">/ 100</span>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center" title="Not scored">
                  <span className="material-symbols-outlined text-[22px] text-on-surface-variant/60">
                    {session.status === 'failed' ? 'error' : 'remove'}
                  </span>
                </div>
              )}
            </div>

            <Link
              href={`/interview/${session.id}?persona=default`}
              className="flex-1 min-w-0 group"
              aria-label={`Open ${session.role_title ?? 'interview'}`}
            >
              <p className="text-[15px] font-semibold text-on-background truncate group-hover:text-primary transition-colors">
                {session.role_title || 'General practice'}
              </p>
              {session.company && (
                <p className="text-[13px] text-on-surface-variant truncate mt-0.5">{session.company}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className={`px-2 py-[3px] rounded text-[11px] font-bold uppercase tracking-wide ${status.className}`}>
                  {status.label}
                </span>
                {duration && <span className="text-xs text-on-surface-variant">{duration}</span>}
                <span className="text-xs text-on-surface-variant">{formatDate(session.created_at)}</span>
                {session.degraded && (
                  <span className="text-xs text-tertiary" title="Some answers could not be scored">
                    Partial report
                  </span>
                )}
              </div>
            </Link>

            <div className="shrink-0 flex items-center gap-1">
              {isConfirming ? (
                <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface p-1">
                  <span className="px-2 text-xs font-medium text-on-surface-variant whitespace-nowrap">Delete?</span>
                  <button
                    onClick={() => handleDelete(session.id)}
                    disabled={isDeleting}
                    className="px-2 py-1 rounded text-xs font-semibold text-error hover:bg-error/10 cursor-pointer disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    disabled={isDeleting}
                    className="px-2 py-1 rounded text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-60"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(session.id)}
                  aria-label="Delete interview"
                  title="Delete interview"
                  className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              )}

              <Link
                href={`/interview/${session.id}?persona=default`}
                aria-label="Open interview"
                className="p-2 rounded-lg text-on-surface-variant/50 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
