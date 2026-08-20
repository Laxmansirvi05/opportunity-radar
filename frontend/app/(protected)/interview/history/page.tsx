import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Interview History | Opportunity Radar',
  description: 'View your past mock interviews and scores.',
}

export default async function InterviewHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <p className="text-on-surface-variant">Please sign in to view your interview history.</p>
      </div>
    )
  }

  const { data: sessions } = await supabase
    .from('interview_sessions')
    .select(`
      id,
      role_title,
      company,
      status,
      started_at,
      ended_at,
      duration_seconds,
      created_at,
      interview_reports (
        overall_score,
        degraded
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    completed: { label: 'Completed', color: 'text-secondary' },
    in_progress: { label: 'In progress', color: 'text-primary' },
    pending: { label: 'Starting…', color: 'text-on-surface-variant' },
    failed: { label: 'Failed', color: 'text-error' },
    abandoned: { label: 'Abandoned', color: 'text-on-surface-variant' },
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '—'
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

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-on-background">Interview History</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {sessions?.length ?? 0} past interview{(sessions?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/interview"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New interview
          </Link>
        </div>

        {(!sessions || sessions.length === 0) ? (
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
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => {
              const st = STATUS_LABELS[session.status] ?? STATUS_LABELS.pending
              // interview_reports is returned as an array by the join; take the first
              const report = Array.isArray(session.interview_reports)
                ? session.interview_reports[0]
                : session.interview_reports
              const score = report?.overall_score

              return (
                <Link
                  key={session.id}
                  href={`/interview/${session.id}?persona=default`}
                  className="interview-card group bg-surface border border-outline-variant rounded-xl px-5 py-4 flex items-center gap-4 transition-all"
                >
                  {/* Score circle — overall_score is a 0-5 value; show it as a
                      percentage to match the report's /100 gauge. */}
                  <div className="w-12 h-12 shrink-0 rounded-full bg-primary-container flex items-center justify-center">
                    {typeof score === 'number' ? (
                      <span className="text-base font-bold text-primary">{Math.round(Math.max(0, Math.min(5, score)) * 20)}</span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant/50 text-[20px]">
                        {session.status === 'completed' ? 'check' : 'schedule'}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {[session.role_title, session.company].filter(Boolean).join(' · ') || 'General practice'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-3">
                      <span className={st.color}>{st.label}</span>
                      {session.duration_seconds && (
                        <span>{formatDuration(session.duration_seconds)}</span>
                      )}
                      <span>{formatDate(session.created_at)}</span>
                    </p>
                  </div>

                  {/* Degraded indicator */}
                  {report?.degraded && (
                    <span className="material-symbols-outlined text-tertiary text-[16px]" title="Partial report">
                      info
                    </span>
                  )}

                  {/* Arrow */}
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary text-[20px] transition-colors">
                    arrow_forward
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
