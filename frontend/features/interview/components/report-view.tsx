import type { ScoreCard } from '@/lib/interview/agent-client'

/**
 * Renders whatever the scorecard actually has. Per the two rules every
 * integration doc in this project repeats: never fabricate, never show a
 * placeholder as data — a missing section is omitted, not filled with
 * "N/A" or a stub.
 */
export function ReportView({
  scorecard,
  degraded,
  roleTitle,
  company,
}: {
  scorecard: ScoreCard
  degraded: boolean
  roleTitle: string | null
  company: string | null
}) {
  const hasScores = (scorecard.competency_scores?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Your interview report</h1>
        {(roleTitle || company) && (
          <p className="text-sm text-on-surface-variant mt-0.5">
            {[roleTitle, company].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {degraded && (
        <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-tertiary-container/40 px-4 py-3 text-sm text-on-surface">
          <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5">info</span>
          <span>
            Partial report — the detailed write-up wasn&apos;t available when this interview was scored.
            {hasScores ? ' Your scores are preserved below.' : ''}
          </span>
        </div>
      )}

      {scorecard.summary && (
        <p className="text-base text-on-surface leading-relaxed">{scorecard.summary}</p>
      )}

      {typeof scorecard.overall_score === 'number' && (
        <div className="bg-surface border border-outline-variant rounded-xl p-6 flex items-center gap-4">
          <span className="text-4xl font-bold text-primary">{Math.round(scorecard.overall_score)}</span>
          <span className="text-sm text-on-surface-variant">Overall score, out of 100</span>
        </div>
      )}

      {hasScores && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Competencies</h2>
          <div className="flex flex-col gap-2">
            {scorecard.competency_scores!.map((c) => (
              <div key={c.name} className="bg-surface border border-outline-variant rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-on-background">{c.name}</span>
                  <span className="text-sm font-bold text-primary">{c.score}/5</span>
                </div>
                {c.comment && <p className="text-xs text-on-surface-variant mt-1">{c.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!scorecard.strengths?.length && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Strengths</h2>
          <ul className="flex flex-col gap-1.5">
            {scorecard.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5">check_circle</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!scorecard.weaknesses?.length && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Areas to improve</h2>
          <ul className="flex flex-col gap-1.5">
            {scorecard.weaknesses.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">arrow_upward</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!scorecard.next_steps?.length && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Next steps</h2>
          <ol className="flex flex-col gap-1.5">
            {scorecard.next_steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                <span className="w-5 h-5 shrink-0 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-mono flex items-center justify-center">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!hasScores && !scorecard.summary && (
        <div className="bg-surface border border-dashed border-outline-variant rounded-xl p-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Scoring didn&apos;t produce a usable report for this run. This is a temporary problem on our side, not a reflection of your interview — try again.
          </p>
        </div>
      )}
    </div>
  )
}
