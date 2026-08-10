"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Download, Lock, RotateCcw, Sparkles, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { tierPlan, completionProgress, targetResumeUnlocked, type Suggestion } from "@/lib/resume-optimizer/tiers"
import type { OptimizationRun } from "./types"

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function scoreRingColor(score: number) {
  if (score >= 75) return "stroke-emerald-500"
  if (score >= 50) return "stroke-amber-500"
  return "stroke-red-500"
}

const importanceColor: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  medium: "border-primary/20 bg-primary/10 text-primary",
  low: "border-muted-foreground/20 bg-muted text-muted-foreground",
}

/** A real score, rendered honestly — no animation pretending it was computed live. */
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          className={cn(scoreRingColor(score), "transition-all duration-500")}
          fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold leading-none", scoreColor(score))}>{score}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">ATS score</span>
      </div>
    </div>
  )
}

export function OptimizerResults({ run, onRunUpdated }: { run: OptimizationRun; onRunUpdated: (run: OptimizationRun) => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const plan = tierPlan(run.tier)
  const progress = completionProgress(run.suggestions)
  const unlocked = targetResumeUnlocked(run.suggestions)

  const toggleSuggestion = async (suggestion: Suggestion) => {
    if (pendingId) return
    setPendingId(suggestion.id)
    try {
      const res = await fetch(`/api/resume/optimization/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: suggestion.id, completed: !suggestion.completed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update the checklist.")

      onRunUpdated(data.run)

      if (data.warning) {
        toast.warning(data.warning)
      } else if (data.run.target_resume && !run.target_resume) {
        toast.success("Every item is confirmed — Resume B is ready to download.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update the checklist.")
    } finally {
      setPendingId(null)
    }
  }

  const retryTargetGeneration = async () => {
    const last = run.suggestions[run.suggestions.length - 1]
    if (!last) return
    await toggleSuggestion({ ...last, completed: false }) // flips true -> re-triggers generation
  }

  return (
    <div className="space-y-5">
      {/* Score + tier — one unified header instead of two stacked cards */}
      <Card className="overflow-hidden border-border/80">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <ScoreRing score={run.baseline_score} />
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {run.target_role} · {run.company_name}
            </p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5">{plan.headline}</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{plan.explanation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Resume A / Resume B — side by side, not two full-width stacked cards */}
      {(plan.generatesPolished || plan.generatesTarget) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.generatesPolished && (
            <Card className="border-border/80 transition-shadow hover:shadow-sm">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">Resume A — polished</p>
                    <p className="text-xs text-muted-foreground leading-tight">Same facts, sharper writing</p>
                  </div>
                </div>
                {run.polished_resume && run.polished_score !== null ? (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-baseline gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={cn("text-xl font-bold", scoreColor(run.polished_score))}>{run.polished_score}</span>
                      <span className="text-xs text-muted-foreground">scored</span>
                    </div>
                    <a href={`/api/resume/optimization/${run.id}/download?variant=polished`}>
                      <Button size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">
                    We could not generate a version we were confident was accurate — your baseline score above is still real.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {plan.generatesTarget && (
            <Card className={cn("border-border/80 transition-shadow", unlocked && "hover:shadow-sm")}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", unlocked ? "bg-primary/10" : "bg-muted")}>
                    {unlocked ? <Sparkles className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">Resume B — aligned to role</p>
                    <p className="text-xs text-muted-foreground leading-tight">Incorporates confirmed work</p>
                  </div>
                </div>
                {!unlocked ? (
                  <p className="text-xs text-muted-foreground pt-1">
                    Locked until every checklist item is confirmed — it would otherwise claim work that isn&apos;t done yet.
                  </p>
                ) : run.target_resume && run.target_score !== null ? (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-baseline gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={cn("text-xl font-bold", scoreColor(run.target_score))}>{run.target_score}</span>
                      <span className="text-xs text-muted-foreground">projected</span>
                    </div>
                    <a href={`/api/resume/optimization/${run.id}/download?variant=target`}>
                      <Button size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">Confirmed, but generation hasn&apos;t produced a version yet.</p>
                    <Button size="sm" variant="outline" onClick={retryTargetGeneration} disabled={!!pendingId}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Suggestion checklist. Interactive and gating Resume B for the 'full'
          tier; for 'polish_only' there is no second resume to unlock (see
          tierPlan), so the same suggestions are shown as plain advice instead
          of a checklist implying a gate that doesn't exist for this tier. */}
      {plan.generatesSuggestions && run.suggestions.length > 0 && (
        <Card className="border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{plan.generatesTarget ? "Close the gap" : "Worth strengthening"}</p>
                {/* max-w-md avoided: --spacing-md in app/globals.css collides with Tailwind's
                    container scale and silently resolves max-w-md to 16px project-wide. */}
                <p className="text-xs text-muted-foreground mt-0.5" style={{ maxWidth: '28rem' }}>
                  {plan.generatesTarget
                    ? "Confirm each item once it's genuinely done — Resume B unlocks only once all are checked."
                    : "Your resume is close enough that we're not generating a second version, but a recruiter would still notice these."}
                </p>
              </div>
              {plan.generatesTarget && (
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold text-foreground">{progress.done}/{progress.total}</span>
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="w-20 mt-1" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              {run.suggestions.map((s) =>
                plan.generatesTarget ? (
                  <button
                    key={s.id}
                    disabled={pendingId === s.id}
                    onClick={() => toggleSuggestion(s)}
                    className={cn(
                      "w-full text-left flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors disabled:opacity-60",
                      s.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                    )}
                  >
                    {s.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.title}</span>
                        <Badge variant="outline" className={cn("text-[0.6rem] uppercase h-4 px-1.5", importanceColor[s.importance])}>
                          {s.importance}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
                    </div>
                  </button>
                ) : (
                  <div key={s.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.title}</span>
                        <Badge variant="outline" className={cn("text-[0.6rem] uppercase h-4 px-1.5", importanceColor[s.importance])}>
                          {s.importance}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
