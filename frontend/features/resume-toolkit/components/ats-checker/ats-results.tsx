"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RotateCcw, Lightbulb, Rocket, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AtsCheckResponse, AtsCategoryScore } from "../../lib/schema/resume/ats-check"

export function AtsResults({
  result,
  targetRole,
  companyName,
  onReset,
}: {
  result: AtsCheckResponse
  targetRole?: string
  companyName?: string
  onReset: () => void
}) {
  const { mode, readiness, atsV2, coaching, suggestions, academicRecommendation, analysisError } = result

  return (
    <div className="space-y-6">

      {/* Targeted mode failed — show the REAL reason, not a generic message
          regardless of which stage actually broke. Readiness is still shown
          below, but clearly labeled as a separate, resume-only fallback —
          never conflated with the targeted match that didn't complete. */}
      {mode === 'targeted' && analysisError && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-md text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Couldn&apos;t calculate a targeted match score</p>
            <p>{analysisError.message}</p>
            <p className="mt-1 text-xs opacity-80">
              Stage: {analysisError.stage === 'jd_extraction' ? 'reading the job description' : analysisError.stage === 'evidence_evaluation' ? 'evaluating your resume against it' : 'unexpected error'}. Your resume&apos;s general readiness score is shown below instead — it does not depend on this job description.
            </p>
          </div>
        </div>
      )}

      {mode === 'targeted' && atsV2 && (
        <div className="w-full">
          <CompactScoreSummary
            title="Overall Match Score"
            score={atsV2.score.overallScore}
            band={atsV2.score.band}
            capabilityScore={atsV2.score.capabilityScore}
            qualityScore={atsV2.score.qualityScore}
            confidence={atsV2.score.confidence}
          />
        </div>
      )}

      {mode === 'resume_only' && (
        <CompactScoreSummary title="Resume Readiness Score" score={readiness.score} />
      )}

      {/* Recruiter Verdict — narration only, grounded in the score above. Omitted
          entirely (not replaced with a placeholder) if the narration call failed. */}
      {coaching?.recruiterVerdict && (
        <Card className="border shadow-md bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Recruiter Verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {coaching.recruiterVerdict}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hard Requirements Warning */}
      {atsV2?.score.hardRequirements && !atsV2.score.hardRequirements.passed && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-md text-sm flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Hard Requirement Warning</p>
            <p>{atsV2.score.hardRequirements.reason || 'One or more mandatory requirements were not met.'}</p>
          </div>
        </div>
      )}

      {/* Requirement Evidence Matrix — the same requirements/evidence that fed
          the score above, so there is nothing here the score didn't come from. */}
      {atsV2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">Requirement Evidence Matrix</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <RequirementsList
              title="Matched Requirements"
              type="success"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              reqs={atsV2.score.requirements.filter(r => r.satisfaction === 'complete' || r.satisfaction === 'substantial')}
            />
            <RequirementsList
              title="Partial Matches"
              type="warning"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              reqs={atsV2.score.requirements.filter(r => r.satisfaction === 'partial')}
            />
            <RequirementsList
              title="Critical Gaps"
              type="error"
              icon={<XCircle className="h-4 w-4 text-red-500" />}
              reqs={atsV2.score.requirements.filter(r => r.satisfaction === 'none' || r.satisfaction === 'insufficient')}
            />
          </div>
        </div>
      )}

      {/* Academic Recommendation — deterministic, mode-agnostic (applies the
          same regardless of whether a JD was supplied). */}
      {academicRecommendation?.visible && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 p-4 rounded-md text-sm flex items-start gap-3 shadow-sm">
          <GraduationCap className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Academic Recommendation</p>
            <p>{academicRecommendation.message}</p>
            <div className="mt-2 text-xs opacity-80 font-mono">
              Observed: {academicRecommendation.observed} | Rule: {academicRecommendation.rule}
            </div>
          </div>
        </div>
      )}

      {/* Readiness Metrics — always shown: the deterministic, JD-independent
          structural read of the resume itself. In resume_only mode this IS
          the analysis; in targeted mode it's supplementary context. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Readiness Metrics</CardTitle>
          <CardDescription>Structure, content quality and professional presentation — independent of any job description.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <CategoryItem label="Core Sections" cat={readiness.categories.coreSections} />
          <CategoryItem label="Structure & Machine Readability" cat={readiness.categories.parsability} />
          <CategoryItem label="Content Quality" cat={readiness.categories.contentQuality} />
          <CategoryItem label="Impact & Achievements" cat={readiness.categories.impact} />
          <CategoryItem label="Skills Presentation" cat={readiness.categories.skills} />
          <CategoryItem label="Professional Quality" cat={readiness.categories.professionalQuality} />
        </CardContent>
      </Card>

      {/* Canonical gap checklist — the same deriver the Optimiser uses for its
          checklist, so this page and /resume/copilot never disagree about
          what's missing for the same resume + job description. */}
      {suggestions.length > 0 && (
        <SuggestionsCard suggestions={suggestions} title={targetRole ? `Closing the gap for ${targetRole}` : 'Suggested improvements'} />
      )}

      {coaching && coaching.powerWords.length > 0 && (
        <PowerWordsCard words={coaching.powerWords} />
      )}

      <div className="flex justify-center pt-6">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Analyze Another Resume
        </Button>
      </div>
    </div>
  )
}

function CategoryItem({ label, cat }: { label: string; cat: AtsCategoryScore }) {
  const percentage = (cat.score / cat.maxScore) * 100
  const color = percentage >= 75 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-500"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">{cat.score}/{cat.maxScore}</span>
      </div>
      <Progress value={percentage} className="h-2" />
      {cat.deductions.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 mt-1 text-red-500/80">
          {cat.deductions.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {cat.evidence.length > 0 && cat.deductions.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1 text-emerald-600/80">✓ {cat.evidence[0]}</p>
      )}
    </div>
  )
}

function CompactScoreSummary({ title, score, band, capabilityScore, qualityScore, confidence }: any) {
  const colorText = score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
  const bgRing = score >= 75 ? "bg-emerald-500/10 border-emerald-500/20" : score >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"

  return (
    <Card className={cn("border shadow-md overflow-hidden")}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row items-center p-6 gap-6">
          <div className={cn("flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4", bgRing, colorText.replace("text-", "border-"))}>
            <span className={cn("font-bold text-4xl tabular-nums tracking-tighter", colorText)}>{score}</span>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h2 className="font-semibold text-2xl tracking-tight">{title}</h2>
            {band && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <Badge variant="outline" className="text-xs font-medium uppercase tracking-wider">{band}</Badge>
                {confidence && (
                  <span className="text-xs text-muted-foreground">Confidence: {confidence.confidenceLevel} ({Math.round(confidence.evaluationCoverage * 100)}% coverage)</span>
                )}
              </div>
            )}
          </div>

          {(capabilityScore !== undefined || qualityScore !== undefined) && (
            <div className="flex gap-6 justify-center md:justify-end md:border-l pl-0 md:pl-6 pt-4 md:pt-0">
              {capabilityScore !== undefined && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Capability</p>
                  <p className="font-bold text-xl">{capabilityScore}</p>
                </div>
              )}
              {qualityScore !== undefined && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Quality</p>
                  <p className="font-bold text-xl">{qualityScore}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RequirementsList({ title, type, icon, reqs }: { title: string, type: 'success' | 'warning' | 'error', icon: React.ReactNode, reqs: any[] }) {
  const bgClasses = {
    success: 'bg-emerald-500/5 border-emerald-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    error: 'bg-red-500/5 border-red-500/20',
  }
  const textClasses = {
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-700 dark:text-red-400',
  }

  return (
    <Card className={cn("border shadow-sm", bgClasses[type])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title} ({reqs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reqs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items found.</p>
        ) : (
          reqs.map((req) => (
            <div key={req.requirementId} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className={cn("text-sm font-medium leading-tight", textClasses[type])}>{req.requirementName}</span>
              </div>
              <p className="text-xs text-muted-foreground/80 line-clamp-2" title={req.gapReason || req.semanticReasoning}>
                {req.gapReason || req.semanticReasoning}
              </p>
              {req.bestEvidenceType && (
                <Badge variant="outline" className="text-[0.65rem] capitalize mt-1 border-primary/20 text-primary/70">
                  {req.bestEvidenceType.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

const importanceColor: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  medium: "border-primary/20 bg-primary/10 text-primary",
  low: "border-muted-foreground/20 bg-muted text-muted-foreground",
}

function SuggestionsCard({ suggestions, title }: { suggestions: AtsCheckResponse['suggestions']; title: string }) {
  const importanceScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const sorted = [...suggestions].sort((a, b) => (importanceScore[b.importance] ?? 0) - (importanceScore[a.importance] ?? 0))
  // Two distinct groups, each shown once — a suggestion used to appear in
  // both this card and "Suggested Projects" below because this card mapped
  // over the unfiltered list.
  const skillSuggestions = sorted.filter((s) => s.type !== 'project')
  const projectSuggestions = sorted.filter((s) => s.type === 'project')

  return (
    <div className="space-y-4">
      {skillSuggestions.length > 0 && (
        <Card className="border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              {title}
            </CardTitle>
            <CardDescription>
              Skills, courses and certifications to close — derived from the requirements above your resume
              doesn&apos;t yet evidence, not a generic checklist.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {skillSuggestions.map((s) => (
              <div key={s.id} className="space-y-1 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-sm">{s.title}</span>
                  <Badge className={cn("text-[0.65rem] uppercase", importanceColor[s.importance])} variant="outline">{s.importance}</Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.detail}</p>
                {s.guidance && (
                  <p className="text-foreground/80 text-sm leading-relaxed mt-2">
                    <span className="font-medium text-primary">How to close this: </span>
                    {s.guidance}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {projectSuggestions.length > 0 && (
        <Card className="border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <Rocket className="h-5 w-5 text-purple-500" />
              Suggested Projects
            </CardTitle>
            <CardDescription>
              Building these would close the specific gaps found above.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {projectSuggestions.map((s) => (
              <div key={s.id} className="space-y-1 rounded-lg border bg-card p-4">
                <p className="font-semibold text-sm mb-1">{s.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.detail}</p>
                {s.guidance && (
                  <p className="text-foreground/80 text-sm leading-relaxed mt-2">
                    <span className="font-medium text-primary">How to close this: </span>
                    {s.guidance}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PowerWordsCard({ words }: { words: string[] }) {
  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Power Words
        </CardTitle>
        <CardDescription>
          Strong action verbs to incorporate into your bullet points.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {words.map((w) => (
            <Badge key={w} variant="secondary" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
              {w}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
