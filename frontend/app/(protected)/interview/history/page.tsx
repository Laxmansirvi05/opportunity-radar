import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  InterviewHistoryList,
  type InterviewHistoryRow,
} from '@/features/interview/components/interview-history-list'

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

  // The join returns interview_reports as an array; flatten to the one row
  // the list needs so the client component takes a plain, typed shape.
  const rows: InterviewHistoryRow[] = (sessions ?? []).map((session) => {
    const report = Array.isArray(session.interview_reports)
      ? session.interview_reports[0]
      : session.interview_reports
    return {
      id: session.id,
      role_title: session.role_title,
      company: session.company,
      status: session.status,
      duration_seconds: session.duration_seconds,
      created_at: session.created_at,
      overall_score: report?.overall_score ?? null,
      degraded: Boolean(report?.degraded),
    }
  })

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

        <InterviewHistoryList sessions={rows} />

      </div>
    </div>
  )
}
