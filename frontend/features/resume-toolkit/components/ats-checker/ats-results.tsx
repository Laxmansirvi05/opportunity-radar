"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Target, RotateCcw, Lightbulb, Rocket, CheckCircle2, AlertTriangle, XCircle, Search, ShieldAlert } from "lucide-react"
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
  const { readiness, jobMatch, coaching, aiFailed, atsV2 } = result

  return (
    <div className="space-y-6">
      
      {aiFailed && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-md text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">AI Services Unavailable</p>
            <p>The core deterministic scoring engine successfully evaluated your resume, but qualitative AI coaching (and advanced job extraction) could not be completed. You can still review the hard metrics below.</p>
          </div>
        </div>
      )}

      {/* Top Row: Scores */}
      <div className="flex justify-center gap-4 flex-wrap">
        {atsV2 ? (
          <ScoreCard
            title="ATS V2 Recruiter Evaluation Score"
            score={atsV2.score.overallScore}
            subtext={`Band: ${atsV2.score.band.toUpperCase()} (Capability: ${atsV2.score.capabilityScore}/100, Quality: ${atsV2.score.qualityScore}/100)`}
          />
        ) : jobMatch ? (
          <ScoreCard title="Targeted ATS Match Score" score={jobMatch.score} />
        ) : (
          <ScoreCard title="ATS Readiness Score" score={readiness.score} />
        )}
      </div>

      {/* Hard Requirements */}
      {atsV2?.score.hardRequirements && !atsV2.score.hardRequirements.passed && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-md text-sm flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Hard Requirement Warning</p>
            <p>{atsV2.score.hardRequirements.reason || 'One or more mandatory requirements were not met.'}</p>
          </div>
        </div>
      )}
      {!atsV2 && jobMatch?.hardRequirements && jobMatch.hardRequirements.length > 0 && (
        <HardRequirementsCard requirements={jobMatch.hardRequirements} />
      )}

      {/* ATS V2 Requirements & Evidence Matrix */}
      {atsV2 && (
        <Card className="border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Recruiter Requirement Evidence Matrix</span>
              <Badge variant="outline" className="capitalize">
                Confidence: {atsV2.score.confidence.confidenceLevel} ({Math.round(atsV2.score.confidence.evaluationCoverage * 100)}% coverage)
              </Badge>
            </CardTitle>
            <CardDescription>
              Demonstrated capability evidence evaluated against target job description requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y rounded-md border">
              {atsV2.score.requirements.map((req) => (
                <div key={req.requirementId} className="p-3 text-sm space-y-1 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{req.requirementName}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs uppercase">
                        {req.importance}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-xs capitalize",
                          req.satisfaction === "complete" || req.satisfaction === "substantial"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : req.satisfaction === "partial"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                        )}
                      >
                        {req.satisfaction}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      Evidence: <strong className="capitalize">{req.evidenceStrength}</strong>
                      {req.bestEvidenceType && ` (${req.bestEvidenceType.replace(/_/g, ' ')})`}
                      {req.hasQuantifiedImpact && ` • Quantified Impact (+10%)`}
                    </span>
                    <span>
                      {req.weightedScore} / {req.maxWeightedScore} pts
                    </span>
                  </div>
                  {req.gapReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 pt-0.5">
                      Gap: {req.gapReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Analysis */}
      {jobMatch && (
        <SkillAnalysisCard 
          evidenced={jobMatch.evidencedSkills} 
          listed={jobMatch.listedSkills} 
          missingRequired={jobMatch.missingRequiredSkills} 
          missingPreferred={jobMatch.missingPreferredSkills} 
        />
      )}

      {/* Categories */}
      {!atsV2 && (
        <div className="grid gap-4 md:grid-cols-2">
          {jobMatch ? (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <CategoryItem label="Required Skills & Tech" cat={jobMatch.categories.requiredSkills} />
                <CategoryItem label="Role Alignment" cat={jobMatch.categories.roleAlignment} />
                <CategoryItem label="Experience Relevance" cat={jobMatch.categories.experienceRelevance} />
                <CategoryItem label="Project Evidence" cat={jobMatch.categories.projectEvidence} />
                <CategoryItem label="Keyword Coverage" cat={jobMatch.categories.keywordCoverage} />
                <CategoryItem label="Education Alignment" cat={jobMatch.categories.educationAlignment} />
                <CategoryItem label="ATS Structure & Machine Readability" cat={jobMatch.categories.atsStructure} />
              </CardContent>
            </Card>
          ) : (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Readiness Metrics</CardTitle>
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
          )}
        </div>
      )}

      {/* Coaching */}
      {coaching && (
        <>
          {coaching.suggestions.length > 0 && (
            <SuggestionsCard suggestions={coaching.suggestions} />
          )}
          {coaching.suggestedProjects.length > 0 && (
            <SuggestedProjectsCard projects={coaching.suggestedProjects} />
          )}
          {coaching.powerWords.length > 0 && (
            <PowerWordsCard words={coaching.powerWords} />
          )}
        </>
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

function ScoreCard({ title, score, subtext }: { title: string; score: number; subtext?: string }) {
  const color = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500"
  const bgRing = score >= 75 ? "from-emerald-500/10 to-transparent" : score >= 50 ? "from-amber-500/10 to-transparent" : "from-red-500/10 to-transparent"

  return (
    <Card className="border shadow-md transition-all duration-300 hover:shadow-lg relative overflow-hidden w-full max-w-sm">
      <CardHeader className="pb-2 text-center">
        <CardTitle className="font-semibold text-xl tracking-tight">
          {title}
        </CardTitle>
        {subtext && <CardDescription className="text-xs">{subtext}</CardDescription>}
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-8 pt-4">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle className="stroke-muted" cx="50" cy="50" r="45" fill="none" strokeWidth="8" />
            <circle
              className={cn("transition-all duration-1000 ease-out", color.replace("text-", "stroke-"))}
              cx="50" cy="50" r="45" fill="none" strokeWidth="8"
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * score) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className={cn("flex h-32 w-32 flex-col items-center justify-center rounded-full bg-gradient-to-b", bgRing)}>
            <span className={cn("font-bold text-5xl tabular-nums tracking-tighter", color)}>{score}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HardRequirementsCard({ requirements }: { requirements: Array<{ rule: string; status: 'Met' | 'Not Met' | 'Unknown' }> }) {
  return (
    <Card className="border shadow-md border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Hard Requirements Checker
        </CardTitle>
        <CardDescription>Explicit disqualifying rules from the job description</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-start justify-between p-3 border rounded-md bg-muted/30">
            <span className="text-sm font-medium">{req.rule}</span>
            {req.status === 'Met' && <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20">MET</Badge>}
            {req.status === 'Not Met' && <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20">NOT MET</Badge>}
            {req.status === 'Unknown' && <Badge className="bg-slate-500/10 text-slate-700 hover:bg-slate-500/20">UNKNOWN</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SkillAnalysisCard({ evidenced, listed, missingRequired, missingPreferred }: { evidenced: string[]; listed: string[]; missingRequired: string[]; missingPreferred: string[] }) {
  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Search className="h-5 w-5 text-muted-foreground" />
          Skills Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(evidenced.length > 0 || listed.length > 0) && (
          <div className="space-y-3">
            <p className="font-medium text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Matched Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {evidenced.map((kw) => (
                <Badge key={`ev-${kw}`} variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  {kw} (Evidenced)
                </Badge>
              ))}
              {listed.map((kw) => (
                <Badge key={`li-${kw}`} variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40 border-dashed">
                  {kw} (Listed)
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {missingRequired.length > 0 && (
          <div className="space-y-3">
            <p className="font-medium text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Missing Required Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {missingRequired.map((kw) => (
                <Badge key={`mr-${kw}`} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {missingPreferred.length > 0 && (
          <div className="space-y-3">
            <p className="font-medium text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Missing Preferred Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {missingPreferred.map((kw) => (
                <Badge key={`mp-${kw}`} variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SuggestionsCard({ suggestions }: { suggestions: any[] }) {
  const impactColor = {
    high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  }

  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          AI Coaching
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <div key={i} className="space-y-1 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-sm">{s.title}</span>
              <Badge className={cn("text-[0.65rem] uppercase", impactColor[s.impact as keyof typeof impactColor])} variant="outline">{s.impact}</Badge>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SuggestedProjectsCard({ projects }: { projects: any[] }) {
  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Rocket className="h-5 w-5 text-purple-500" />
          Suggested Projects
        </CardTitle>
        <CardDescription>
          Build these to close skill gaps and improve your Job Match score.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {projects.map((p, i) => (
          <div key={i} className="space-y-1 rounded-lg border bg-card p-4">
            <p className="font-semibold text-sm mb-1">{p.title}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{p.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
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
