"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, UploadCloud, FileText, Loader2 } from "lucide-react"
import type { AtsCheckResponse } from "../../lib/schema/resume/ats-check"
import { AtsResults } from "./ats-results"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

type ResumeSource = "saved" | "upload"

export function AtsCheckerDashboard() {
  const [resumeSource, setResumeSource] = useState<ResumeSource>("saved")
  const [resumeId, setResumeId] = useState<string>("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  
  const [jobDescription, setJobDescription] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [jobUrl, setJobUrl] = useState("")

  const [result, setResult] = useState<AtsCheckResponse | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [resumes, setResumes] = useState<{ id: string; title: string | null }[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)
  const [isLoadingReport, setIsLoadingReport] = useState(false)

  const searchParams = useSearchParams()
  const reopenReportId = searchParams.get("reportId")

  useEffect(() => {
    let mounted = true
    const loadResumes = async () => {
      setIsLoadingResumes(true)
      try {
        const res = await fetch('/api/resume/list')
        if (!res.ok) throw new Error('Failed to load resumes')
        const data = await res.json()
        if (mounted) setResumes(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setIsLoadingResumes(false)
      }
    }
    loadResumes()
    return () => { mounted = false }
  }, [])

  // Reopening a past ATS check from history: the stored report_data is the
  // exact same AtsCheckResponse shape a fresh analyse produces, so it feeds
  // straight into the same result view — no separate "viewing history"
  // render path to keep in sync with the live one.
  useEffect(() => {
    if (!reopenReportId) return
    let mounted = true
    // This effect kicks off an async fetch whose first statement flips a
    // loading flag. The rule fires on that synchronous setState, but moving it
    // after the await would mean the spinner only appears once the request is
    // already in flight — a worse experience traded for a green lint line.
    // Same justification convention as hub-message.tsx and tracker-board.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingReport(true)
    fetch(`/api/resume/ats-history/${reopenReportId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not load this report.")
        if (mounted) setResult(data.report)
      })
      .catch((err: unknown) => {
        if (mounted) toast.error(err instanceof Error ? err.message : "Could not load this report.")
      })
      .finally(() => {
        if (mounted) setIsLoadingReport(false)
      })
    return () => { mounted = false }
  }, [reopenReportId])

  const hasResumeInput = resumeSource === "saved" ? !!resumeId : !!uploadedFile
  // A job description is optional: leaving it blank runs a resume-only
  // readiness check instead of a targeted match. Role/company and the JD
  // length floor only apply once a JD has actually been started.
  const hasJd = jobDescription.trim().length > 0
  const isValidRole = !hasJd || targetRole.trim().length > 0
  const isValidCompany = !hasJd || companyName.trim().length > 0
  const isValidJD = !hasJd || jobDescription.trim().length >= 100
  let isUrlValid = true
  if (jobUrl.trim().length > 0) {
    try {
      new URL(jobUrl.trim())
    } catch {
      isUrlValid = false
    }
  }

  const canAnalyze = hasResumeInput && isValidRole && isValidCompany && isValidJD && isUrlValid

  const onAnalyze = async () => {
    if (!canAnalyze || isAnalyzing) return
    setIsAnalyzing(true)
    setResult(null)

    try {
      const payload: Record<string, unknown> = {
        jobDescription: jobDescription.trim(),
        companyName: companyName.trim(),
        targetRole: targetRole.trim(),
        jobUrl: jobUrl.trim() || undefined
      }

      if (resumeSource === "upload" && uploadedFile) {
        toast.loading("Extracting resume data...", { id: "ats-progress" })

        const formData = new FormData()
        formData.append("file", uploadedFile)

        // The same dedicated flat-ParsedResume extractor the Optimiser uses
        // (not /api/resume/parse, which targets the Resume Builder's much
        // larger nested schema and was found unreliable for this purpose —
        // see lib/resume-optimizer/extract-resume.ts).
        const parseRes = await fetch("/api/resume/optimization/extract", {
          method: "POST",
          body: formData,
        })

        const parsed = await parseRes.json()
        if (!parseRes.ok) {
          throw new Error(parsed.error || "Extraction failed")
        }

        payload.resumeData = parsed.resume
      } else if (resumeSource === "saved" && resumeId) {
        payload.resumeId = resumeId
      }

      toast.loading("Analyzing ATS Compatibility...", { id: "ats-progress" })

      // A generous but bounded timeout — the route can legitimately take up
      // to ~170s in the worst case (multiple AI provider fallbacks across
      // several sequential calls), just under its own 180s server-side
      // ceiling, so the client surfaces a clear message instead of an
      // indefinite spinner if something really does hang.
      const checkRes = await fetchWithTimeout("/api/resume/ats-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 170_000)

      if (!checkRes.ok) {
        const err = await checkRes.json()
        throw new Error(err.error || "Analysis failed")
      }

      const data = await checkRes.json()
      setResult(data)
      toast.success("Analysis complete!", { id: "ats-progress" })
    } catch (error: unknown) {
      console.error(error)
      toast.error((error instanceof Error ? error.message : '') || "An error occurred during analysis.", { id: "ats-progress" })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const onReset = () => {
    setResult(null)
    setJobDescription("")
    setCompanyName("")
    setTargetRole("")
    setJobUrl("")
    setUploadedFile(null)
    setResumeId("")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">ATS Analysis</h1>
        <p className="text-muted-foreground">
          Paste a job description for a targeted match score against that role, or leave it blank for a general
          resume readiness check — both use the same evidence-based scoring, never keyword matching.
        </p>
      </div>

      {isLoadingReport ? (
        <Card className="bg-card">
          <CardContent className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading this report...
          </CardContent>
        </Card>
      ) : !result ? (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Analysis Setup</CardTitle>
            <CardDescription>Select a resume. Add a job description for a targeted match, or skip it for a readiness check.</CardDescription>
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
                  <Select value={resumeId} onValueChange={(val) => setResumeId(val || '')}>
                    <SelectTrigger className="w-full sm:w-[400px]">
                      {/* Base UI's SelectValue has no Radix-style automatic label
                          lookup — without a children render function (or an `items`
                          map on Select.Root, per its own docs) it falls back to
                          printing the raw selected `value` itself. Since SelectItem's
                          value here is the resume's id, that meant a real resume UUID
                          rendering in the trigger after selection instead of its title. */}
                      <SelectValue placeholder="Choose a resume to analyze...">
                        {(value: string) => {
                          if (!value) return "Choose a resume to analyze..."
                          if (value === "sample-frontend-dev") return "Sample Candidate (Frontend Developer)"
                          return resumes?.find((r) => r.id === value)?.title || "Untitled Resume"
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sample-frontend-dev">
                        Sample Candidate (Frontend Developer)
                      </SelectItem>
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
                {uploadedFile && (
                  <p className="text-xs text-muted-foreground">
                    This file will be analyzed temporarily and will not be permanently saved.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Job Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                rows={8}
                value={jobDescription}
                placeholder="Paste the complete job posting here for a targeted match — or leave blank for a general resume readiness check..."
                onChange={(e) => setJobDescription(e.target.value)}
                className="resize-y"
              />
              {!isValidJD && jobDescription.length > 0 && (
                <p className="text-xs text-destructive">Please paste the full job description so we can calculate an accurate targeted match.</p>
              )}
            </div>

            {!hasJd && (
              <p className="text-xs text-muted-foreground -mt-2">
                Target role and company are tied to a specific job — paste a job description above to fill them in. Without one, this runs as a general resume readiness check instead.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Role {hasJd && <span className="text-destructive">*</span>}</Label>
                <Input
                  placeholder="e.g. Frontend Developer"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  disabled={!hasJd}
                />
                {!isValidRole && targetRole.length > 0 && (
                  <p className="text-xs text-destructive">Target role is required.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Company Name {hasJd && <span className="text-destructive">*</span>}</Label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  disabled={!hasJd}
                />
                {!isValidCompany && companyName.length > 0 && (
                  <p className="text-xs text-destructive">Company name is required.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job URL (Optional)</Label>
              <Input
                placeholder="https://example.com/jobs/123"
                value={jobUrl}
                onChange={e => setJobUrl(e.target.value)}
              />
              {!isUrlValid && (
                <p className="text-xs text-destructive">Please enter a valid URL.</p>
              )}
            </div>

            <Button className="w-full sm:w-auto" size="lg" disabled={!canAnalyze || isAnalyzing} onClick={onAnalyze}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  {hasJd ? "Analyze Targeted Match" : "Check Resume Readiness"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AtsResults result={result} targetRole={targetRole} companyName={companyName} onReset={onReset} />
      )}
    </div>
  )
}
