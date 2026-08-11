'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface OpportunityContext {
  id: string
  title: string
  company: string | null
}

export function InterviewStart({ opportunity }: { opportunity: OpportunityContext | null }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunity ? { opportunity_id: opportunity.id } : {}),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error?.message ?? 'Could not start the interview.')
        setStarting(false)
        return
      }
      router.push(`/interview/${body.session_id}`)
    } catch {
      setError('Could not start the interview. Check your connection and try again.')
      setStarting(false)
    }
  }

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-8 flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
      <span className="material-symbols-outlined text-primary text-[40px]">record_voice_over</span>
      <div>
        <h1 className="text-xl font-bold text-on-background">
          {opportunity ? `Practice for ${opportunity.title}` : 'Practice mock interview'}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {opportunity
            ? `A short voice interview tailored to this role${opportunity.company ? ` at ${opportunity.company}` : ''}. Uses the resume already in Resume Builder — no upload needed.`
            : "A short voice interview based on the resume already in Resume Builder. Pick a specific opportunity first if you'd like it tailored to a real role."}
        </p>
      </div>

      <ul className="text-xs text-on-surface-variant/80 flex flex-col gap-1 text-left w-full">
        <li className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">mic</span>
          Needs microphone access — you&apos;ll be asked to allow it
        </li>
        <li className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">timer</span>
          Roughly 10–15 minutes, audio only
        </li>
        <li className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">insights</span>
          Scored feedback afterward — strengths, gaps, next steps
        </li>
      </ul>

      {error && (
        <div className="w-full bg-error-container text-on-error-container rounded-lg px-4 py-2.5 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={start}
        disabled={starting}
        className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {starting ? 'Starting…' : 'Start interview'}
      </button>
    </div>
  )
}
