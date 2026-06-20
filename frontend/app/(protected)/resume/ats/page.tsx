'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runAtsCheckAction } from './actions'
import type { AtsCheckResult } from '@reactive-resume/schema/resume/ats-check'

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
    <div className="flex flex-col gap-xl p-lg h-full overflow-y-auto">
      <header>
        <h2 className="font-headline-lg text-on-background mb-xs">ATS Score Checker</h2>
        <p className="font-body-md text-on-surface-variant">
          Analyze how well your resume matches a specific job description.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg flex-1">
        {/* Input Section */}
        <div className="flex flex-col gap-md bg-surface border border-outline-variant rounded-2xl p-md shadow-sm">
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Select Resume</label>
            <select 
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full bg-surface-container border border-outline rounded-lg p-sm"
            >
              {resumes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title || r.file_name || 'Untitled Resume'} (Updated: {new Date(r.updated_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col min-h-[300px]">
            <label className="block text-label-md font-bold text-on-surface mb-xs">Job Description</label>
            <textarea 
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full flex-1 bg-surface-container border border-outline rounded-lg p-sm resize-none"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || resumes.length === 0}
            className="w-full py-sm bg-primary text-on-primary rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isAnalyzing ? (
              <><span className="material-symbols-outlined animate-spin">sync</span> Analyzing...</>
            ) : (
              <><span className="material-symbols-outlined">fact_check</span> Analyze Match</>
            )}
          </button>
          
          {error && <div className="text-error text-sm mt-2">{error}</div>}
        </div>

        {/* Results Section */}
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md overflow-y-auto">
          {result ? (
            <div className="flex flex-col gap-lg">
              {/* Score Header */}
              <div className="flex items-center gap-md">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-headline-lg font-bold ${
                  result.score >= 75 ? 'bg-green-100 text-green-700' :
                  result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {result.score}%
                </div>
                <div>
                  <h3 className="text-title-lg font-bold text-on-background">
                    {result.recommendation === 'high_chance' ? 'Strong Match' :
                     result.recommendation === 'medium_chance' ? 'Moderate Match' : 'Needs Improvement'}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">Based on keywords and section analysis</p>
                </div>
              </div>

              {/* Keywords */}
              <div className="flex flex-col gap-sm">
                <h4 className="font-bold text-title-md">Keywords</h4>
                <div className="flex gap-4">
                  <div className="flex-1 bg-green-50/50 p-sm rounded-lg border border-green-100">
                    <p className="font-semibold text-green-800 text-sm mb-2">Matched ({result.keywordAnalysis.matched.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {result.keywordAnalysis.matched.map((kw, i) => (
                        <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-red-50/50 p-sm rounded-lg border border-red-100">
                    <p className="font-semibold text-red-800 text-sm mb-2">Missing ({result.keywordAnalysis.missing.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {result.keywordAnalysis.missing.map((kw, i) => (
                        <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div className="flex flex-col gap-sm">
                  <h4 className="font-bold text-title-md">Suggestions for Improvement</h4>
                  <ul className="space-y-3">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="bg-surface p-sm rounded-lg border border-outline-variant shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-on-surface">{s.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.impact === 'high' ? 'bg-red-100 text-red-700' :
                            s.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{s.impact}</span>
                        </div>
                        <p className="text-sm text-on-surface-variant">{s.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-6xl opacity-20 mb-md">analytics</span>
              <p>Paste a job description and click Analyze to see your ATS score.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
