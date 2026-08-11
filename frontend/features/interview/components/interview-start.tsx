'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONAS, DEFAULT_PERSONA_ID, type PersonaId } from '../lib/personas'

interface OpportunityContext {
  id: string
  title: string
  company: string | null
}

export function InterviewStart({ opportunity }: { opportunity: OpportunityContext | null }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personaId, setPersonaId] = useState<PersonaId>(DEFAULT_PERSONA_ID)

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
      router.push(`/interview/${body.session_id}?persona=${personaId}`)
    } catch {
      setError('Could not start the interview. Check your connection and try again.')
      setStarting(false)
    }
  }

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-8 flex flex-col items-center text-center gap-5 w-full max-w-2xl mx-auto">
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

      <div className="w-full text-left">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">
          Interviewer style
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PERSONAS.map((p) => {
            const selected = p.id === personaId
            return (
              <button
                key={p.id}
                onClick={() => setPersonaId(p.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-center ${
                  selected
                    ? 'border-primary bg-primary-container/20'
                    : 'border-outline-variant hover:border-outline'
                }`}
              >
                <span
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center border border-outline-variant/50`}
                >
                  <span className="material-symbols-outlined text-on-surface text-[20px]">{p.icon}</span>
                </span>
                <div>
                  <p className="text-xs font-semibold text-on-background">{p.name}</p>
                  <p className="text-[10.5px] text-on-surface-variant leading-tight mt-0.5">{p.style}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <ul className="text-xs text-on-surface-variant/80 flex flex-col gap-1 text-left w-full">
        <li className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">mic</span>
          Needs microphone access — you&apos;ll be asked to allow it
        </li>
        <li className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">timer</span>
          Roughly 10–15 minutes, audio only. You can also type answers if audio ever fails
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
