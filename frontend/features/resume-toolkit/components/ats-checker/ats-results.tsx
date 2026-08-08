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
            <p className="font-semibold">ATS V2 Analysis Failure</p>
            <p>The AI was unable to extract meaningful requirements from the provided job description after all fallback attempts. We cannot calculate a reliable Targeted Match Score without valid requirements.</p>
          </div>
        </div>
      )}

      {/* Top Row: Compact Score Summary */}
      {!aiFailed && (
      <div className="w-full">
        {atsV2 ? (
          <CompactScoreSummary
            title="Overall Match Score"
            score={atsV2.score.overallScore}
            band={atsV2.score.band}
            capabilityScore={atsV2.score.capabilityScore}
            qualityScore={atsV2.score.qualityScore}
            confidence={atsV2.score.confidence}
          />
        ) : jobMatch ? (
          <CompactScoreSummary title="Targeted ATS Match Score" score={jobMatch.score} />
        ) : (
          <CompactScoreSummary title="ATS Readiness Score" score={readiness.score} />
        )}
      </div>
      )}

      {/* Recruiter Verdict */}
      {coaching && coaching.recruiterVerdict && (
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
      {!atsV2 && jobMatch?.hardRequirements && jobMatch.hardRequirements.length > 0 && (
        <HardRequirementsCard requirements={jobMatch.hardRequirements} />
      )}

      {/* Requirements Breakdown (V2) */}
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

      {/* CGPA Recommendation */}
      {atsV2?.score.cgpaRecommendation?.visible && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 p-4 rounded-md text-sm flex items-start gap-3 shadow-sm mt-4">
          <Lightbulb className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Academic Recommendation</p>
            <p>{atsV2.score.cgpaRecommendation.message}</p>
            <div className="mt-2 text-xs opacity-80 font-mono">
              Observed: {atsV2.score.cgpaRecommendation.observed} | Rule: {atsV2.score.cgpaRecommendation.rule}
            </div>
          </div>
        </div>
      )}

      {/* Skills Analysis (Legacy) */}
      {!atsV2 && jobMatch && (
        <SkillAnalysisCard 
          evidenced={jobMatch.evidencedSkills} 
          listed={jobMatch.listedSkills} 
          missingRequired={jobMatch.missingRequiredSkills} 
          missingPreferred={jobMatch.missingPreferredSkills} 
        />
      )}

      {/* Legacy Categories */}
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

function HardRequirementsCard({ requirements }: { requirements: Array<{ rule: string; status: 'Met' | 'Not Met' | 'Unknown' }> }) {
  return (
    <Card className="border shadow-md border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Hard Requirements Checker
        </CardTitle>
        <CardDescription>
          Explicit rules or constraints found in the job description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50 text-sm">
            <span>{req.rule}</span>
            <Badge
              variant="outline"
              className={cn(
                req.status === 'Met' ? 'text-emerald-500 border-emerald-500' :
                req.status === 'Not Met' ? 'text-red-500 border-red-500' :
                'text-amber-500 border-amber-500'
              )}
            >
              {req.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SkillAnalysisCard({ evidenced, listed, missingRequired, missingPreferred }: any) {
  if (evidenced.length === 0 && listed.length === 0 && missingRequired.length === 0 && missingPreferred.length === 0) {
    return (
      <Card className="border shadow-md">
        <CardContent className="p-6 text-center text-muted-foreground">
          No structured skills data found for this analysis.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Target className="h-5 w-5 text-primary" />
          Targeted Keyword Analysis
        </CardTitle>
        <CardDescription>
          How well your resume covers the requested skills.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {evidenced.length > 0 && (
          <div className="space-y-3">
            <p className="font-medium text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Strong Evidence Matches
            </p>
            <div className="flex flex-wrap gap-2">
              {evidenced.map((kw: string) => (
                <Badge key={`ev-${kw}`} variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {listed.length > 0 && (
          <div className="space-y-3">
            <p className="font-medium text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Listed Only (Weak Evidence)
            </p>
            <div className="flex flex-wrap gap-2">
              {listed.map((kw: string) => (
                <Badge key={`li-${kw}`} variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
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
              {missingRequired.map((kw: string) => (
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
              {missingPreferred.map((kw: string) => (
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
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  }

  // Sort by impact: high -> medium -> low
  const impactScore = { high: 3, medium: 2, low: 1 }
  const sorted = [...suggestions].sort((a, b) => impactScore[b.impact as keyof typeof impactScore] - impactScore[a.impact as keyof typeof impactScore])

  return (
    <Card className="border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Top Improvements
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {sorted.map((s, i) => (
          <div key={i} className="space-y-1 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
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
