"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, UploadCloud, FileText, Loader2, ArrowLeft, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { OptimizerResults } from "./optimizer-results"
import type { OptimizationRun, RunSummary } from "./types"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

type ResumeSource = "saved" | "upload"

export function ResumeOptimizerDashboard() {
  const [view, setView] = useState<"form" | "result">("form")
  const [run, setRun] = useState<OptimizationRun | null>(null)

  const searchParams = useSearchParams()
  const preselectedResumeId = searchParams.get("resume") ?? ""

  const [resumeSource, setResumeSource] = useState<ResumeSource>("saved")
  const [resumeId, setResumeId] = useState<string>(preselectedResumeId)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [jobDescription, setJobDescription] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [targetRole, setTargetRole] = useState("")

  const [resumes, setResumes] = useState<{ id: string; title: string | null }[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [history, setHistory] = useState<RunSummary[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/resume/list")
        if (!res.ok) throw new Error("Failed to load resumes")
        const data = await res.json()
        if (mounted) setResumes(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setIsLoadingResumes(false)
      }
    })()

    ;(async () => {
      try {
        const res = await fetch("/api/resume/optimization")
        if (!res.ok) throw new Error("Failed to load past runs")
        const data = await res.json()
        if (mounted) setHistory(data.runs)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setIsLoadingHistory(false)
      }
    })()

    return () => { mounted = false }
  }, [])

  const openRun = async (id: string) => {
    try {
      const res = await fetch(`/api/resume/optimization/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load this run.")
      setRun(data.run)
      setView("result")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load this run.")
    }
  }

  // Reopening a past run from the /resume history section (?runId=...) —
  // the same path the in-page "Past runs" list below already uses.
  const preselectedRunId = searchParams.get("runId") ?? ""
  useEffect(() => {
    if (preselectedRunId) openRun(preselectedRunId)
     
  }, [preselectedRunId])

  const hasResumeInput = resumeSource === "saved" ? !!resumeId : !!uploadedFile
  const isValidRole = targetRole.trim().length > 0
  const isValidCompany = companyName.trim().length > 0
  const isValidJD = jobDescription.trim().length >= 100
  const canSubmit = hasResumeInput && isValidRole && isValidCompany && isValidJD && !isSubmitting

  const onSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        jobDescription: jobDescription.trim(),
        companyName: companyName.trim(),
        targetRole: targetRole.trim(),
      }

      if (resumeSource === "upload" && uploadedFile) {
        toast.loading("Extracting resume data...", { id: "optimizer-progress" })
        const formData = new FormData()
        formData.append("file", uploadedFile)
        const parseRes = await fetch("/api/resume/optimization/extract", { method: "POST", body: formData })
        const parsed = await parseRes.json()
        if (!parseRes.ok) throw new Error(parsed.error || "Extraction failed")
        payload.resumeData = parsed.resume
      } else {
        payload.resumeId = resumeId
      }

      toast.loading("Scoring your resume against this role — this can take up to a minute...", { id: "optimizer-progress" })
      // A generous but bounded timeout — a full run can legitimately chain
      // up to ~6 sequential AI calls with provider fallback, just under the
      // route's own 300s server-side ceiling, so the client surfaces a
      // clear message instead of an indefinite spinner if something hangs.
      const res = await fetchWithTimeout("/api/resume/optimization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 290_000)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not run the optimisation.")

      setRun(data.run)
      setView("result")
      setHistory((prev) => [{
        id: data.run.id,
        target_role: data.run.target_role,
        company_name: data.run.company_name,
        baseline_score: data.run.baseline_score,
        tier: data.run.tier,
        polished_score: data.run.polished_score,
        target_score: data.run.target_score,
        created_at: data.run.created_at,
        updated_at: data.run.updated_at,
      }, ...prev])

      if (data.warning) toast.warning(data.warning)
      else toast.success("Analysis complete.", { id: "optimizer-progress" })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.", { id: "optimizer-progress" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const startNew = () => {
    setRun(null)
    setView("form")
    setJobDescription("")
    setCompanyName("")
    setTargetRole("")
    setUploadedFile(null)
    setResumeId("")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Resume Optimiser</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your real ATS score against a specific job, plus suggested projects, courses and skills — never work
          experience, since that cannot be built without an interview.
        </p>
      </div>

      {view === "result" && run ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={startNew} className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            New optimisation
          </Button>
          <OptimizerResults run={run} onRunUpdated={setRun} />
        </div>
      ) : (
        <>
          <Card className="bg-card border-border/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">New optimisation</CardTitle>
              <CardDescription>Select a resume and the role you are targeting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Resume Source *</Label>
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => { setResumeSource("saved"); setUploadedFile(null) }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      resumeSource === "saved" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Saved Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResumeSource("upload"); setResumeId("") }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      resumeSource === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    Upload PDF
                  </button>
                </div>
              </div>

              {resumeSource === "saved" && (
                <div className="space-y-2">
                  {isLoadingResumes ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading resumes...
                    </div>
                  ) : (
                    <Select value={resumeId} onValueChange={(val) => setResumeId(val || "")}>
                      <SelectTrigger className="w-full sm:w-[400px]">
                        {/* Same fix as the ATS Checker's identical selector: Base UI's
                            SelectValue has no automatic label lookup without a children
                            render function, so it was printing the raw resume id (a UUID)
                            in the trigger instead of the resume's title after selection. */}
                        <SelectValue placeholder="Choose a resume to optimise...">
                          {(value: string) => {
                            if (!value) return "Choose a resume to optimise..."
                            return resumes?.find((r) => r.id === value)?.title || "Untitled Resume"
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {resumes?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.title || "Untitled Resume"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {resumeSource === "upload" && (
                <div className="space-y-2">
                  <Input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setUploadedFile(file)
                    }}
                  />
                  <Button
                    variant="outline"
                    className="h-auto w-full sm:w-[400px] flex-col border-dashed py-6 font-normal hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadedFile ? (
                      <>
                        <FileText className="h-6 w-6 text-primary mb-1.5" />
                        <p className="font-medium text-foreground text-sm">{uploadedFile.name}</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 text-muted-foreground mb-1.5" />
                        <p className="text-muted-foreground text-sm">Click to upload PDF resume</p>
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Role *</Label>
                  <Input placeholder="e.g. Frontend Developer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input placeholder="e.g. Acme Corp" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Description *</Label>
                <Textarea
                  rows={8}
                  value={jobDescription}
                  placeholder="Paste the complete job posting here..."
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="resize-y"
                />
                {!isValidJD && jobDescription.length > 0 && (
                  <p className="text-xs text-destructive">Please paste the full job description so we can calculate an accurate score.</p>
                )}
              </div>

              <Button className="w-full sm:w-auto" size="lg" disabled={!canSubmit} onClick={onSubmit}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Run optimisation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {!isLoadingHistory && history.length > 0 && (
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  Past runs
                </CardTitle>
                <CardDescription className="text-xs">Persisted across logout — pick up where you left off.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => openRun(h.id)}
                    className="w-full text-left flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-muted/50 hover:border-muted-foreground/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{h.target_role} at {h.company_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 ml-2">Baseline {h.baseline_score}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
