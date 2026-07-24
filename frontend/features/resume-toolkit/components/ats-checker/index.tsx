"use client"

import { useState, useRef, useEffect } from "react"
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

  const hasResumeInput = resumeSource === "saved" ? !!resumeId : !!uploadedFile
  const isValidRole = targetRole.trim().length > 0
  const isValidCompany = companyName.trim().length > 0
  const isValidJD = jobDescription.trim().length >= 100
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
      let payload: any = {
        jobDescription: jobDescription.trim(),
        companyName: companyName.trim(),
        targetRole: targetRole.trim(),
        jobUrl: jobUrl.trim() || undefined
      }

      if (resumeSource === "upload" && uploadedFile) {
        toast.loading("Extracting resume data...", { id: "ats-progress" })
        
        const formData = new FormData()
        formData.append("file", uploadedFile)

        const parseRes = await fetch("/api/resume/parse", {
          method: "POST",
          body: formData,
        })
        
        if (!parseRes.ok) {
          const err = await parseRes.json()
          throw new Error(err.error || "Extraction failed")
        }
        
        const parsedData = await parseRes.json()
        payload.resumeData = parsedData
      } else if (resumeSource === "saved" && resumeId) {
        payload.resumeId = resumeId
      }

      toast.loading("Analyzing ATS Compatibility...", { id: "ats-progress" })

      const checkRes = await fetch("/api/resume/ats-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!checkRes.ok) {
        const err = await checkRes.json()
        throw new Error(err.error || "Analysis failed")
      }

      const data = await checkRes.json()
      setResult(data)
      toast.success("Analysis complete!", { id: "ats-progress" })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "An error occurred during analysis.", { id: "ats-progress" })
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
        <h1 className="text-3xl font-bold tracking-tight">Targeted ATS Match</h1>
        <p className="text-muted-foreground">
          Opportunity Radar evaluates how well your resume matches a specific job role and company using a 100-point deterministic formula.
        </p>
      </div>

      {!result ? (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Analysis Setup</CardTitle>
            <CardDescription>Select a resume and provide a job description for a targeted match score.</CardDescription>
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
                      <SelectValue placeholder="Choose a resume to analyze..." />
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
                {uploadedFile && (
                  <p className="text-xs text-muted-foreground">
                    This file will be analyzed temporarily and will not be permanently saved.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Role *</Label>
                <Input 
                  placeholder="e.g. Frontend Developer" 
                  value={targetRole} 
                  onChange={e => setTargetRole(e.target.value)} 
                />
                {!isValidRole && targetRole.length > 0 && (
                  <p className="text-xs text-destructive">Target role is required.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input 
                  placeholder="e.g. Acme Corp" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
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
                <p className="text-xs text-destructive">Please paste the full job description so we can calculate an accurate targeted match.</p>
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
                  Analyze Targeted Match
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AtsResults result={result} onReset={onReset} />
      )}
    </div>
  )
}
