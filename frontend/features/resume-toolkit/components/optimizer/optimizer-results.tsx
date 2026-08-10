"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Download, Lock, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { tierPlan, completionProgress, targetResumeUnlocked, type Suggestion } from "@/lib/resume-optimizer/tiers"
import type { OptimizationRun } from "./types"

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

const importanceColor: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  medium: "border-primary/20 bg-primary/10 text-primary",
  low: "border-muted-foreground/20 bg-muted text-muted-foreground",
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
    <div className="space-y-6">
      {/* Baseline — always shown, real, never hidden */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your resume, as uploaded</span>
            <span className={cn("text-3xl font-bold", scoreColor(run.baseline_score))}>{run.baseline_score}</span>
          </CardTitle>
          <CardDescription>
            Real ATS v2 score against {run.target_role} at {run.company_name}. This number never changes based on what
            gets generated below.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Tier message */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="font-semibold text-foreground">{plan.headline}</p>
          <p className="text-sm text-muted-foreground mt-1">{plan.explanation}</p>
        </CardContent>
      </Card>

      {/* Resume A — polished */}
      {plan.generatesPolished && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Resume A — polished
            </CardTitle>
            <CardDescription>Same facts, sharper structure and wording. Always available for this tier.</CardDescription>
          </CardHeader>
          <CardContent>
            {run.polished_resume && run.polished_score !== null ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Scored </span>
                  <span className={cn("font-semibold", scoreColor(run.polished_score))}>{run.polished_score}</span>
                </div>
                <a href={`/api/resume/optimization/${run.id}/download?variant=polished`}>
                  <Button size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                We could not generate a version we were confident was accurate, so nothing has been produced. Your
                baseline score above is still real.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestion checklist. Interactive and gating Resume B for the 'full'
          tier; for 'polish_only' there is no second resume to unlock (see
          tierPlan), so the same suggestions are shown as plain advice instead
          of a checklist implying a gate that doesn't exist for this tier. */}
      {plan.generatesSuggestions && run.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{plan.generatesTarget ? "Close the gap" : "Worth strengthening"}</CardTitle>
            <CardDescription>
              {plan.generatesTarget
                ? "Confirm each item once it is genuinely done. Resume B presents these as real work, so it only unlocks once every item here is checked."
                : "Your resume is close enough that we're not generating a second version — but these are the spots a recruiter would still notice."}
            </CardDescription>
            {plan.generatesTarget && (
              <>
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground">{progress.done} of {progress.total} confirmed</p>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {run.suggestions.map((s) =>
              plan.generatesTarget ? (
                <button
                  key={s.id}
                  disabled={pendingId === s.id}
                  onClick={() => toggleSuggestion(s)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-colors disabled:opacity-60",
                    s.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  {s.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.title}</span>
                      <Badge variant="outline" className={cn("text-[0.65rem] uppercase", importanceColor[s.importance])}>
                        {s.importance}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
                  </div>
                </button>
              ) : (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.title}</span>
                      <Badge variant="outline" className={cn("text-[0.65rem] uppercase", importanceColor[s.importance])}>
                        {s.importance}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Resume B — target */}
      {plan.generatesTarget && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {unlocked ? <Sparkles className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
              Resume B — aligned to this role
            </CardTitle>
            <CardDescription>
              Incorporates the confirmed work above. The score is a projection until every item is actually done —
              which the checklist enforces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!unlocked ? (
              <p className="text-sm text-muted-foreground">
                Locked until every item on the checklist is confirmed. Without checking it, you cannot download this
                version — it would otherwise claim work that is not done yet.
              </p>
            ) : run.target_resume && run.target_score !== null ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Projected score </span>
                  <span className={cn("font-semibold", scoreColor(run.target_score))}>{run.target_score}</span>
                </div>
                <a href={`/api/resume/optimization/${run.id}/download?variant=target`}>
                  <Button size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Everything is confirmed, but generation has not produced a version we were confident was accurate yet.
                </p>
                <Button size="sm" variant="outline" onClick={retryTargetGeneration} disabled={!!pendingId}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
