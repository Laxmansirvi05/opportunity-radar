import Link from 'next/link'
import type { ScoreCard } from '@/lib/interview/agent-client'

/**
 * Renders whatever the scorecard actually has. Per the two rules every
 * integration doc in this project repeats: never fabricate, never show a
 * placeholder as data — a missing section is omitted, not filled with
 * "N/A" or a stub.
 *
 * Now also renders model answers (what a great answer would have looked like)
 * and a "Try again" link that takes the student back to the intake screen.
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-background">Your interview report</h1>
          {(roleTitle || company) && (
            <p className="text-sm text-on-surface-variant mt-0.5">
              {[roleTitle, company].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Link
          href="/interview"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">replay</span>
          Try again
        </Link>
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

      {typeof scorecard.overall_score === 'number' && (() => {
        // The agent scores on a 0-5 scale (see post/prompts.py "OVERALL SCORE
        // /5"); students expect a percentage, so present it out of 100.
        const pct = Math.round(Math.max(0, Math.min(5, scorecard.overall_score)) * 20)
        const band = pct >= 75 ? 'Strong' : pct >= 50 ? 'Solid, with gaps' : pct >= 25 ? 'Needs work' : 'Early stage'
        const ring = pct >= 75 ? 'text-emerald-500' : pct >= 50 ? 'text-primary' : pct >= 25 ? 'text-amber-500' : 'text-error'
        return (
          <div className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface p-6 flex items-center gap-6">
            <div className="relative grid place-items-center h-24 w-24 shrink-0">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-outline-variant/40" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  className={`${ring} transition-all duration-700`}
                  strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${pct} 100`}
                />
              </svg>
              <span className="absolute text-2xl font-bold text-on-background">{pct}</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Overall score</p>
              <p className="text-3xl font-bold text-on-background leading-tight">{pct}<span className="text-lg text-on-surface-variant font-semibold"> / 100</span></p>
              <p className={`text-sm font-semibold ${ring}`}>{band}</p>
            </div>
          </div>
        )
      })()}

      {hasScores && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Competencies</h2>
          <div className="flex flex-col gap-2">
            {scorecard.competency_scores!.map((c, i) => {
              // The agent names the field `competency` (with `evidence`/`level`);
              // fall back to name/comment for older payloads.
              const label = c.competency || c.name || `Competency ${i + 1}`
              const detail = c.evidence || c.comment
              return (
                <div key={label + i} className="bg-surface border border-outline-variant rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-on-background">
                      {label}
                      {c.level && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">{c.level}</span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-primary shrink-0">{c.score}/5</span>
                  </div>
                  {detail && <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{detail}</p>}
                </div>
              )
            })}
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

      {!!scorecard.model_answers?.length && (
        <div>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Model answers</h2>
          <p className="text-xs text-on-surface-variant mb-2">
            What a strong answer would have covered for each question.
          </p>
          <div className="flex flex-col gap-2">
            {scorecard.model_answers.map((ma) => (
              <div key={ma.question_id} className="bg-surface border border-outline-variant rounded-lg px-4 py-3">
                <p className="text-xs text-on-surface-variant mb-1 font-semibold uppercase tracking-wide">
                  {ma.question_id.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-on-surface leading-relaxed">{ma.answer}</p>
              </div>
            ))}
          </div>
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

      {/* Bottom actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-outline-variant">
        <Link
          href="/interview"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">replay</span>
          Start a new interview
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg text-on-surface-variant text-sm font-medium hover:bg-surface-container"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
