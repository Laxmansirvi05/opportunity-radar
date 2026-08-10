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
import { OptimizerResults } from "./optimizer-results"
import type { OptimizationRun, RunSummary } from "./types"

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
        const parseRes = await fetch("/api/resume/parse", { method: "POST", body: formData })
        if (!parseRes.ok) {
          const err = await parseRes.json()
          throw new Error(err.error || "Extraction failed")
        }
        payload.resumeData = await parseRes.json()
      } else {
        payload.resumeId = resumeId
      }

      toast.loading("Scoring your resume against this role — this can take up to a minute...", { id: "optimizer-progress" })
      const res = await fetch("/api/resume/optimization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
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
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Resume Optimiser</h1>
        <p className="text-muted-foreground">
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
          <Card className="bg-card">
            <CardHeader>
              <CardTitle>New optimisation</CardTitle>
              <CardDescription>Select a resume and the role you are targeting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Resume Source *</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={resumeSource === "saved" ? "default" : "outline"}
                    onClick={() => { setResumeSource("saved"); setUploadedFile(null) }}
                  >
                    Saved Resume
                  </Button>
                  <Button
                    size="sm"
                    variant={resumeSource === "upload" ? "default" : "outline"}
                    onClick={() => { setResumeSource("upload"); setResumeId("") }}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload PDF
                  </Button>
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
                        <SelectValue placeholder="Choose a resume to optimise..." />
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
                    className="h-auto w-full sm:w-[400px] flex-col border-dashed py-8 font-normal hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadedFile ? (
                      <>
                        <FileText className="h-8 w-8 text-primary mb-2" />
                        <p className="font-medium text-foreground">{uploadedFile.name}</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Click to upload PDF resume</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Past runs
                </CardTitle>
                <CardDescription>Persisted across logout — pick up where you left off.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => openRun(h.id)}
                    className="w-full text-left flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{h.target_role} at {h.company_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline">Baseline {h.baseline_score}</Badge>
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
