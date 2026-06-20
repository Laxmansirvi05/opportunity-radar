'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runAtsCheckAction } from './actions'
import type { AtsCheckResult } from '@reactive-resume/schema/resume/ats-check'
import { Target, Loader2, FileCheck, CheckCircle2, AlertCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function AtsScoreCheckerPage() {
  const [resumes, setResumes] = useState<any[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AtsCheckResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchResumes = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('resumes')
          .select('id, title, file_name, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
        
        if (data) {
          setResumes(data)
          if (data.length > 0) setSelectedResumeId(data[0].id)
        }
      }
    }
    fetchResumes()
  }, [])

  const handleAnalyze = async () => {
    if (!selectedResumeId) {
      setError('Please select a resume')
      return
    }
    if (!jobDescription.trim()) {
      setError('Please enter a job description')
      return
    }

    setIsAnalyzing(true)
    setError('')
    setResult(null)

    try {
      const analysisResult = await runAtsCheckAction(selectedResumeId, jobDescription)
      setResult(analysisResult)
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 p-8 md:p-12 lg:p-16 h-full overflow-y-auto">
      <div className="space-y-1 mb-8">
        <h2 className="text-3xl font-bold tracking-tight">ATS Score</h2>
        <p className="text-muted-foreground">
          Analyze how well your resume matches a specific job description.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Select a resume and paste the job description</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Select Resume</label>
                <select 
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.title || r.file_name || 'Untitled Resume'} (Updated: {new Date(r.updated_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 flex-1 min-h-[300px]">
                <label className="text-sm font-medium leading-none">Job Description</label>
                <textarea 
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="flex min-h-[250px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || resumes.length === 0}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Target className="mr-2 h-4 w-4" /> Analyze Match</>
                )}
              </Button>
              
              {error && <div className="text-destructive text-sm font-medium">{error}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="flex flex-col h-full">
          {result ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score Header */}
                <div className="flex items-center gap-6">
                  <div className={`flex size-24 shrink-0 items-center justify-center rounded-full text-3xl font-bold ${
                    result.score >= 75 ? 'bg-green-100 text-green-700' :
                    result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {result.score}%
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">
                      {result.recommendation === 'high_chance' ? 'Strong Match' :
                       result.recommendation === 'medium_chance' ? 'Moderate Match' : 'Needs Improvement'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Based on keywords and section analysis</p>
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="size-4" /> Keywords
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
                      <p className="text-sm font-semibold text-green-800 mb-3">
                        Matched ({result.keywordAnalysis.matched.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.keywordAnalysis.matched.map((kw, i) => (
                          <span key={i} className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-sm font-semibold text-destructive mb-3">
                        Missing ({result.keywordAnalysis.missing.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.keywordAnalysis.missing.map((kw, i) => (
                          <span key={i} className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="size-4" /> Suggestions for Improvement
                    </h4>
                    <div className="space-y-3">
                      {result.suggestions.map((s, i) => (
                        <div key={i} className="flex flex-col gap-1 rounded-lg border p-4 bg-card shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm">{s.title}</span>
                            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.impact === 'high' ? 'bg-destructive/10 text-destructive' :
                              s.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {s.impact} impact
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground opacity-50">
              <FileCheck className="size-16" />
              <p>Paste a job description and click Analyze</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
