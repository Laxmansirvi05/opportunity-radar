'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createResume } from '@/features/resume-toolkit/services/resume-actions'
import type { ResumeData } from '@reactive-resume/schema/resume/data'

// ---------------------------------------------------------------------------
// Types matching the atsCheckResultSchema
// ---------------------------------------------------------------------------
type AtsCheckResult = {
  score: number
  keywordAnalysis: { matched: string[]; missing: string[] }
  sectionAnalysis: { section: string; score: number; feedback: string }[]
  suggestions: { title: string; description: string; impact: 'high' | 'medium' | 'low' }[]
  suggestedProjects: { title: string; description: string }[]
  powerWords: string[]
  recommendation: 'high_chance' | 'medium_chance' | 'needs_improvement'
}

type ResumeListItem = { id: string; title: string }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Analysis failed. Please try again.'
}

export default function AtsCheckerClient() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)

  const [resumeSource, setResumeSource] = useState<'saved' | 'upload'>('saved')
  const [resumeId, setResumeId] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')

  const [result, setResult] = useState<AtsCheckResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch user's resumes on mount
  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch('/api/resume/list')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setResumes(data.flatMap((row): ResumeListItem[] => {
              if (!row || typeof row !== 'object') return []
              const candidate = row as { id?: unknown; title?: unknown }
              return typeof candidate.id === 'string' && typeof candidate.title === 'string'
                ? [{ id: candidate.id, title: candidate.title }]
                : []
            }))
          }
        }
      } catch { /* ignore */ }
      setLoadingResumes(false)
    }
    loadResumes()
  }, [])

  const hasResumeInput = resumeSource === 'saved' ? !!resumeId : !!uploadedFile
  const hasJobDescription = jobDescription.trim().length > 10
  const canAnalyze = hasResumeInput && hasJobDescription && !isAnalyzing

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return
    setIsAnalyzing(true)

    try {
      let targetResumeId = resumeId

      // If upload mode, first parse the file into a resume
      if (resumeSource === 'upload' && uploadedFile) {
        toast.loading('Parsing uploaded resume…', { id: 'ats-progress' })
        const formData = new FormData()
        formData.append('file', uploadedFile)

        const parseRes = await fetch('/api/resume/parse', { method: 'POST', body: formData })
        if (!parseRes.ok) {
          const err = await parseRes.json().catch(() => ({ error: 'Parse failed' }))
          throw new Error(err.error)
        }

        const resumeData: ResumeData = await parseRes.json()

        // Create a temp resume to store the parsed data
        toast.loading('Saving parsed resume…', { id: 'ats-progress' })
        const title = uploadedFile.name.replace(/\.pdf$/i, '') || 'ATS Upload'
        const created = await createResume(title, resumeData)
        if (!created.success) throw new Error(created.error || 'Failed to save uploaded resume')
        targetResumeId = created.id
      }

      if (!targetResumeId) throw new Error('No resume selected.')

      toast.loading('Running ATS analysis…', { id: 'ats-progress' })

      const res = await fetch('/api/resume/ats-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: targetResumeId,
          jobDescription,
          companyName: companyName || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(err.error)
      }

      const data: AtsCheckResult = await res.json()
      setResult(data)
      toast.success('ATS analysis completed!', { id: 'ats-progress' })
    } catch (err: unknown) {
      console.error('[ATS]', err)
      toast.error(errorMessage(err), { id: 'ats-progress' })
    } finally {
      setIsAnalyzing(false)
    }
  }, [canAnalyze, resumeId, resumeSource, uploadedFile, jobDescription, companyName])

  const handleReset = useCallback(() => {
    setResult(null)
    setJobDescription('')
    setCompanyName('')
    setUploadedFile(null)
    setResumeId('')
  }, [])

  // ─── RESULT VIEW ───────────────────────────────────────────────────────
  if (result) {
    return <AtsResults result={result} onReset={handleReset} />
  }

  // ─── INPUT VIEW ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Resume Source Toggle */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => { setResumeSource('saved'); setUploadedFile(null) }}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0',
            backgroundColor: resumeSource === 'saved' ? '#4F46E5' : '#fff',
            color: resumeSource === 'saved' ? '#fff' : '#4A5568',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Select Saved Resume
        </button>
        <button
          onClick={() => { setResumeSource('upload'); setResumeId('') }}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0',
            backgroundColor: resumeSource === 'upload' ? '#4F46E5' : '#fff',
            color: resumeSource === 'upload' ? '#fff' : '#4A5568',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>upload</span>
          Upload from Device
        </button>
      </div>

      {/* Resume Input: Saved */}
      {resumeSource === 'saved' && (
        <div>
          {loadingResumes ? (
            <p style={{ color: '#718096', fontSize: '14px' }}>Loading resumes…</p>
          ) : resumes.length === 0 ? (
            <p style={{ color: '#718096', fontSize: '14px' }}>No saved resumes. Create one first.</p>
          ) : (
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid #E2E8F0', fontSize: '14px', backgroundColor: '#fff',
              }}
            >
              <option value="">Choose a resume to analyze…</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Resume Input: Upload */}
      {resumeSource === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '32px', borderRadius: '10px',
              border: '2px dashed #CBD5E0', backgroundColor: '#FAFBFC',
              cursor: 'pointer', textAlign: 'center', fontSize: '14px', color: '#4A5568',
            }}
          >
            {uploadedFile ? (
              <><span className="material-symbols-outlined" style={{ fontSize: '24px', verticalAlign: 'middle' }}>description</span> {uploadedFile.name}</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: '24px', verticalAlign: 'middle' }}>cloud_upload</span> Click to upload PDF, PNG, or JPEG</>
            )}
          </button>
        </div>
      )}

      {/* Job Description */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#2D3748', marginBottom: '6px' }}>
          Job Description
        </label>
        <textarea
          rows={10}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here…"
          style={{
            width: '100%', padding: '12px', borderRadius: '8px',
            border: '1px solid #E2E8F0', fontSize: '14px', resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <p style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '4px' }}>
          Paste the complete job posting for the most accurate analysis.
        </p>
      </div>

      {/* Company Name */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#2D3748', marginBottom: '6px' }}>
          Company Name (optional)
        </label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Google, Microsoft…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: '1px solid #E2E8F0', fontSize: '14px',
          }}
        />
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        style={{
          width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
          backgroundColor: canAnalyze ? '#4F46E5' : '#CBD5E0',
          color: canAnalyze ? '#fff' : '#A0AEC0',
          fontSize: '15px', fontWeight: 600, cursor: canAnalyze ? 'pointer' : 'not-allowed',
        }}
      >
        {isAnalyzing ? (
          <>
            <span style={{
              display: 'inline-block', width: '14px', height: '14px',
              border: '2px solid currentColor', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              verticalAlign: 'middle', marginRight: '8px',
            }} />
            Analyzing resume…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '6px' }}>search</span>
            Analyze ATS Compatibility
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Results Components (ported from RR with OR styling)
// ─────────────────────────────────────────────────────────────────────────────

function AtsResults({ result, onReset }: { result: AtsCheckResult; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Score + Recommendation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ScoreCard score={result.score} />
        <RecommendationCard recommendation={result.recommendation} />
      </div>

      <KeywordAnalysisCard matched={result.keywordAnalysis.matched} missing={result.keywordAnalysis.missing} />
      <SectionAnalysisCard sections={result.sectionAnalysis} />
      <SuggestionsCard suggestions={result.suggestions} />
      {result.suggestedProjects.length > 0 && <SuggestedProjectsCard projects={result.suggestedProjects} />}
      {result.powerWords.length > 0 && <PowerWordsCard words={result.powerWords} />}

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
        <button
          onClick={onReset}
          style={{
            padding: '10px 24px', borderRadius: '8px', border: '1px solid #E2E8F0',
            backgroundColor: '#fff', color: '#4A5568', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>restart_alt</span>
          Analyze Another Resume
        </button>
      </div>
    </div>
  )
}

function ScoreCard({ score }: { score: number }) {
  const color = score >= 75 ? '#48BB78' : score >= 50 ? '#ECC94B' : '#F56565'
  const bgGradient = score >= 75 ? '#C6F6D520' : score >= 50 ? '#FEFCBF30' : '#FED7D720'

  return (
    <div style={{
      border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px',
      backgroundColor: '#fff', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4A5568' }}>target</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>ATS Score</span>
      </div>
      <div style={{
        width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto',
        background: `conic-gradient(${color} ${score * 3.6}deg, #EDF2F7 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          backgroundColor: bgGradient, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#fff',
        }}>
          <span style={{ fontSize: '36px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
          <span style={{ fontSize: '11px', color: '#A0AEC0', fontWeight: 600, textTransform: 'uppercase' }}>/100</span>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ recommendation }: { recommendation: AtsCheckResult['recommendation'] }) {
  const config = {
    high_chance: { label: 'High Chance', desc: 'Your resume is well-aligned with this role.', color: '#48BB78', bg: '#F0FFF4', icon: 'check_circle' },
    medium_chance: { label: 'Medium Chance', desc: 'Your resume has potential but needs some improvements.', color: '#ECC94B', bg: '#FFFFF0', icon: 'warning' },
    needs_improvement: { label: 'Needs Improvement', desc: 'Significant changes recommended for this role.', color: '#F56565', bg: '#FFF5F5', icon: 'cancel' },
  }[recommendation]

  return (
    <div style={{
      border: `1px solid ${config.color}30`, borderRadius: '12px', padding: '24px',
      backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4A5568' }}>rocket_launch</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Recommendation</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: config.bg }}>
        <span className="material-symbols-outlined" style={{ fontSize: '24px', color: config.color }}>{config.icon}</span>
        <div>
          <p style={{ fontWeight: 600, color: '#2D3748' }}>{config.label}</p>
          <p style={{ fontSize: '13px', color: '#718096' }}>{config.desc}</p>
        </div>
      </div>
    </div>
  )
}

function KeywordAnalysisCard({ matched, missing }: { matched: string[]; missing: string[] }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4A5568' }}>search</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Keyword Analysis</span>
      </div>
      <p style={{ fontSize: '13px', color: '#A0AEC0', marginBottom: '16px' }}>
        {matched.length} matched · {missing.length} missing
      </p>

      {matched.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#48BB78', marginBottom: '8px' }}>Matched Keywords</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {matched.map((kw) => (
              <span key={kw} style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                backgroundColor: '#F0FFF4', color: '#22543D', border: '1px solid #C6F6D5',
              }}>{kw}</span>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#F56565', marginBottom: '8px' }}>Missing Keywords</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {missing.map((kw) => (
              <span key={kw} style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                backgroundColor: '#FFF5F5', color: '#742A2A', border: '1px solid #FED7D7',
              }}>{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionAnalysisCard({ sections }: { sections: AtsCheckResult['sectionAnalysis'] }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4A5568' }}>bar_chart</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Section Analysis</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {sections.map((s) => {
          const color = s.score >= 75 ? '#48BB78' : s.score >= 50 ? '#ECC94B' : '#F56565'
          return (
            <div key={s.section} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2D3748' }}>{s.section}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{s.score}/100</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#EDF2F7', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.score}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
              </div>
              <p style={{ fontSize: '12px', color: '#718096', lineHeight: 1.5 }}>{s.feedback}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuggestionsCard({ suggestions }: { suggestions: AtsCheckResult['suggestions'] }) {
  const impactColors = {
    high: { bg: '#FFF5F5', color: '#C53030', border: '#FED7D7' },
    medium: { bg: '#FFFFF0', color: '#B7791F', border: '#FEFCBF' },
    low: { bg: '#EBF8FF', color: '#2B6CB0', border: '#BEE3F8' },
  }

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ECC94B' }}>lightbulb</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Improvement Suggestions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {suggestions.map((s, i) => {
          const ic = impactColors[s.impact]
          return (
            <div key={i} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2D3748' }}>{s.title}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', backgroundColor: ic.bg, color: ic.color, border: `1px solid ${ic.border}`,
                }}>{s.impact}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#718096', lineHeight: 1.5 }}>{s.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuggestedProjectsCard({ projects }: { projects: AtsCheckResult['suggestedProjects'] }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#9F7AEA' }}>rocket_launch</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Suggested Projects</span>
      </div>
      <p style={{ fontSize: '12px', color: '#A0AEC0', marginBottom: '16px' }}>Project ideas to strengthen your resume for this role</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {projects.map((p, i) => (
          <div key={i} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#2D3748', marginBottom: '4px' }}>{p.title}</p>
            <p style={{ fontSize: '12px', color: '#718096', lineHeight: 1.5 }}>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PowerWordsCard({ words }: { words: string[] }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ECC94B' }}>bolt</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#2D3748' }}>Power Words</span>
      </div>
      <p style={{ fontSize: '12px', color: '#A0AEC0', marginBottom: '16px' }}>Strong action verbs and keywords to incorporate</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {words.map((w) => (
          <span key={w} style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
            backgroundColor: '#EBF4FF', color: '#3182CE', border: '1px solid #BEE3F8',
          }}>{w}</span>
        ))}
      </div>
    </div>
  )
}
