'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ATSResponse, ATSAnalysisResult, isATSFallback } from '@/types/ats'

interface ATSAnalysisCardProps {
  opportunityId: string
  expired?: boolean
}

export function ATSAnalysisCard({ opportunityId, expired = false }: ATSAnalysisCardProps) {
  const [data, setData] = useState<ATSResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchATSScore = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/ats/analyze?opportunity_id=${opportunityId}`)
        
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to fetch ATS analysis')
        }

        const jsonData = await res.json()
        setData(jsonData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchATSScore()
  }, [opportunityId])

  if (expired) {
    return (
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">ATS Match Score</h3>
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/50 text-center">
          <span className="material-symbols-outlined text-outline mb-2 text-2xl">timer_off</span>
          <p className="text-sm font-medium text-on-surface-variant">This opportunity has expired.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-pulse">
        <div className="h-4 w-32 bg-surface-container-high rounded mb-2"></div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-container-high shrink-0"></div>
          <div className="flex flex-col gap-2 w-full">
            <div className="h-4 w-full bg-surface-container-high rounded"></div>
            <div className="h-4 w-2/3 bg-surface-container-high rounded"></div>
          </div>
        </div>
        <div className="h-[1px] w-full bg-outline-variant/30 my-2"></div>
        <div className="h-8 w-full bg-surface-container-high rounded-lg"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-surface border border-error-container rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">ATS Match Score</h3>
        <div className="p-4 rounded-xl bg-error-container/20 text-error text-sm font-medium flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  if (isATSFallback(data)) {
    return (
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">psychology</span>
          ATS Match Analysis
        </h3>
        <div className="p-4 rounded-xl bg-primary-container/10 border border-primary/20 flex flex-col gap-3 items-center text-center">
          <span className="material-symbols-outlined text-3xl text-primary">upload_file</span>
          <p className="text-sm font-medium text-on-surface-variant">{data.message}</p>
          <Link 
            href="/resume" 
            className="w-full py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 transition-opacity mt-1 cursor-pointer block"
          >
            Upload Resume
          </Link>
        </div>
      </div>
    )
  }

  // Success State
  const result = data as ATSAnalysisResult
  const scoreColor = 
    result.ats_score >= 80 ? 'text-[#137333] border-[#137333]' : 
    result.ats_score >= 50 ? 'text-[#f57c00] border-[#f57c00]' : 
    'text-error border-error'
    
  const scoreBg = 
    result.ats_score >= 80 ? 'bg-[#E6F4EA]' : 
    result.ats_score >= 50 ? 'bg-[#fff3e0]' : 
    'bg-error-container/20'

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-primary">radar</span>
          Resume Match
        </h3>
      </div>
      
      {/* Match Score Display */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-full border-[3px] flex items-center justify-center shrink-0 ${scoreColor} ${scoreBg}`}>
          <span className="text-xl font-bold">{result.ats_score}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-bold text-on-surface text-lg">
            {result.ats_score >= 80 ? 'Strong Match' : result.ats_score >= 50 ? 'Fair Match' : 'Weak Match'}
          </span>
          <span className="text-xs text-on-surface-variant">
            Based on {result.gap_analysis.matched_skills.length} matching skills and experience.
          </span>
        </div>
      </div>

      <div className="h-[1px] w-full bg-outline-variant/30 my-1"></div>

      {/* Strengths */}
      {result.gap_analysis.matched_skills.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-[#137333] uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Strengths
          </span>
          <div className="flex flex-wrap gap-1.5">
            {result.gap_analysis.matched_skills.slice(0, 5).map((skill) => (
              <span key={skill} className="px-2 py-1 rounded bg-[#E6F4EA] text-[#137333] text-[11px] font-bold">
                {skill}
              </span>
            ))}
            {result.gap_analysis.matched_skills.length > 5 && (
              <span className="px-2 py-1 rounded bg-surface-container text-on-surface-variant text-[11px] font-medium">
                +{result.gap_analysis.matched_skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Missing Skills (Weaknesses) */}
      {result.gap_analysis.missing_skills.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-[#f57c00] uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Missing Keywords
          </span>
          <div className="flex flex-wrap gap-1.5">
            {result.gap_analysis.missing_skills.slice(0, 5).map((m) => (
              <span key={m.skill} className="px-2 py-1 rounded bg-[#fff3e0] text-[#f57c00] text-[11px] font-bold flex items-center gap-1 border border-[#f57c00]/30">
                {m.skill}
                {m.importance === 'HIGH' && <span className="w-1.5 h-1.5 rounded-full bg-error" title="High Importance"></span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience / Education Gaps */}
      {(result.gap_analysis.experience_gap || result.gap_analysis.education_gap) && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-[11px] font-bold text-error uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">cancel</span>
            Critical Gaps
          </span>
          <ul className="text-xs text-on-surface-variant flex flex-col gap-1.5">
            {result.gap_analysis.experience_gap && (
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-error mt-0.5">remove</span>
                <span>{result.gap_analysis.experience_gap.gap}</span>
              </li>
            )}
            {result.gap_analysis.education_gap && (
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-error mt-0.5">remove</span>
                <span>{result.gap_analysis.education_gap.gap}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Improvement Suggestions */}
      {result.improvement_suggestions.length > 0 && (
        <div className="mt-2 p-3 bg-primary-container/10 rounded-xl border border-primary/20 flex flex-col gap-2">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lightbulb</span>
            Suggestion
          </span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {result.improvement_suggestions[0]}
          </p>
        </div>
      )}
      
      {/* CTA */}
      <Link href="/resume" className="w-full mt-1 py-2 border border-outline-variant rounded-lg font-label-md text-on-surface hover:bg-surface-container transition-colors font-medium text-center cursor-pointer block">
        Update Resume
      </Link>
    </div>
  )
}
