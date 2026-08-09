'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'
import {
  tierPresentation,
  shortfallIsOurFault,
  TYPICAL_RUNTIME_MIN,
  MAX_RUNTIME_MIN,
  type AgentResult,
  type AgentOpportunity,
} from '@/lib/ai-search/agent-client'

const POLL_MS = 15_000

type Phase = 'idle' | 'uploading' | 'running' | 'done' | 'error'

interface JobResponse {
  job_id?: string
  status?: 'processing' | 'complete' | 'failed'
  result?: AgentResult
  error?: { code: string; message: string }
  transient_error?: string
  created_at?: string
  already_running?: boolean
}

/** Stages shown while the pipeline runs. Indicative, not a real progress bar —
 *  the agent exposes no progress, and a fake percentage would be a lie. */
const STAGES = [
  { at: 0,   label: 'Reading your resume' },
  { at: 45,  label: 'Building your profile' },
  { at: 120, label: 'Searching for openings' },
  { at: 300, label: 'Scoring each match against your resume' },
  { at: 600, label: 'Finishing up — almost there' },
]

export function AiSearchClient() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const startedAt = useRef<number | null>(null)

  // Resume any run already in flight, so closing the tab does not lose it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ai-search')
        const { job } = (await res.json()) as { job: (JobResponse & { id?: string }) | null }
        if (cancelled || !job) return

        const id = job.id ?? job.job_id ?? null
        if (job.status === 'complete' && job.result) {
          setResult(job.result); setPhase('done')
        } else if (job.status === 'failed') {
          setError(job.error?.message ?? 'That search did not finish.'); setPhase('error')
        } else if (job.status === 'processing' && id) {
          setJobId(id)
          startedAt.current = job.created_at ? new Date(job.created_at).getTime() : Date.now()
          setPhase('running')
        }
      } catch { /* nothing in flight */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Elapsed clock while running.
  useEffect(() => {
    if (phase !== 'running') return
    const tick = () => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [phase])

  // Poll at the cadence the agent's guide specifies.
  useEffect(() => {
    if (phase !== 'running' || !jobId) return
    let stop = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/ai-search/${jobId}`, { cache: 'no-store' })
        const data = (await res.json()) as JobResponse
        if (stop) return

        if (data.transient_error) { setNotice(data.transient_error); return }
        setNotice(null)

        if (data.status === 'complete' && data.result) {
          setResult(data.result); setPhase('done'); stop = true
        } else if (data.status === 'failed') {
          setError(data.error?.message ?? 'That search did not finish.'); setPhase('error'); stop = true
        }
      } catch { /* keep polling; a dropped poll is not a failed run */ }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { stop = true; clearInterval(t) }
  }, [phase, jobId])

  const choose = (f: File | null) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF. Export from Word with “Save as PDF” rather than renaming.')
      return
    }
    if (f.size > 5 * 1024 * 1024) { toast.error('That file is over 5 MB.'); return }
    setFile(f)
  }

  const start = useCallback(async () => {
    if (!file) return
    setPhase('uploading'); setError(null); setNotice(null)

    const form = new FormData()
    form.append('resume', file)

    try {
      const res = await fetch('/api/ai-search', { method: 'POST', body: form })
      const data = (await res.json()) as JobResponse

      if (!res.ok) {
        setError(data.error?.message ?? 'We could not start that search.')
        setPhase('error')
        return
      }
      if (data.already_running) toast.info('You already have a search running — showing that one.')

      setJobId(data.job_id ?? null)
      startedAt.current = Date.now()
      setElapsed(0)
      setPhase('running')
    } catch {
      setError('We could not reach the server. Please try again.')
      setPhase('error')
    }
  }, [file])

  const reset = () => {
    setPhase('idle'); setJobId(null); setResult(null)
    setError(null); setNotice(null); setFile(null); startedAt.current = null
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col gap-6">
        <header>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <h1 className="text-2xl md:text-3xl font-bold text-on-background">AI Search</h1>
          </div>
          <p className="text-sm text-on-surface-variant">
            Upload your resume and our agent searches the internet for openings that genuinely fit it,
            then scores each one against your experience.
          </p>
        </header>

        {phase === 'idle' && (
          <UploadPanel
            file={file}
            dragOver={dragOver}
            setDragOver={setDragOver}
            inputRef={inputRef}
            onChoose={choose}
            onStart={start}
          />
        )}

        {(phase === 'uploading' || phase === 'running') && (
          <RunningPanel elapsed={elapsed} uploading={phase === 'uploading'} notice={notice} />
        )}

        {phase === 'error' && (
          <div className="bg-surface border border-outline-variant rounded-2xl p-8 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-error text-[40px]">error</span>
            <h2 className="font-bold text-on-background">That search did not finish</h2>
            <p className="text-sm text-on-surface-variant max-w-md">{error}</p>
            <button onClick={reset} className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 cursor-pointer">
              Try again
            </button>
          </div>
        )}

        {phase === 'done' && result && <Results result={result} onReset={reset} />}
      </div>
    </div>
  )
}

// ── upload ──────────────────────────────────────────────────────────────────

function UploadPanel({
  file, dragOver, setDragOver, inputRef, onChoose, onStart,
}: {
  file: File | null
  dragOver: boolean
  setDragOver: (v: boolean) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onChoose: (f: File | null) => void
  onStart: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onChoose(e.dataTransfer.files?.[0] ?? null) }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface hover:border-primary/60'}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[28px]">upload_file</span>
        </div>
        {file ? (
          <>
            <p className="font-bold text-on-background">{file.name}</p>
            <p className="text-xs text-on-surface-variant">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</p>
          </>
        ) : (
          <>
            <p className="font-bold text-on-background">Drop your resume here, or click to browse</p>
            <p className="text-xs text-on-surface-variant">PDF only, up to 5 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onChoose(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Setting the time expectation up front is the whole difference between
          this feeling broken and feeling like it is working. */}
      <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5">schedule</span>
        <div className="text-sm text-on-surface-variant">
          <p className="font-semibold text-on-surface mb-0.5">This takes {TYPICAL_RUNTIME_MIN}–{MAX_RUNTIME_MIN} minutes</p>
          <p>
            The agent reads your resume, searches the web for live openings and scores each one. You can
            leave this page — the search keeps running and will be here when you come back.
          </p>
        </div>
      </div>

      <button
        onClick={onStart}
        disabled={!file}
        className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
        Find my matches
      </button>
    </div>
  )
}

// ── running ─────────────────────────────────────────────────────────────────

function RunningPanel({ elapsed, uploading, notice }: { elapsed: number; uploading: boolean; notice: string | null }) {
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) ?? STAGES[0]
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="material-symbols-outlined text-primary text-[24px]">auto_awesome</span>
      </div>

      <div>
        <h2 className="font-bold text-on-background text-lg">
          {uploading ? 'Uploading your resume…' : stage.label}
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} elapsed · usually {TYPICAL_RUNTIME_MIN}–{MAX_RUNTIME_MIN} minutes
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-1.5">
        {STAGES.map((s) => {
          const done = elapsed > s.at && s.at !== stage.at
          const current = s.at === stage.at
          return (
            <div key={s.at} className={`flex items-center gap-2 text-xs ${current ? 'text-on-surface font-semibold' : done ? 'text-on-surface-variant' : 'text-on-surface-variant/50'}`}>
              <span className={`material-symbols-outlined text-[16px] ${done ? 'text-secondary' : current ? 'text-primary' : 'text-outline'}`}>
                {done ? 'check_circle' : current ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
              {s.label}
            </div>
          )
        })}
      </div>

      {notice && (
        <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">{notice}</p>
      )}

      <p className="text-xs text-on-surface-variant/80 max-w-sm">
        Safe to leave this page — the search continues and your results will be waiting.
      </p>
    </div>
  )
}

// ── results ─────────────────────────────────────────────────────────────────

function Results({ result, onReset }: { result: AgentResult; onReset: () => void }) {
  const { headline, feedbackProminence } = tierPresentation(result.result_tier, result.opportunity_count)
  const ourFault = shortfallIsOurFault(result)
  const feedback = result.resume_feedback?.trim()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-on-background">{headline}</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Scored against your resume and ranked by fit.
          </p>
        </div>
        <button onClick={onReset} className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container cursor-pointer flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          New search
        </button>
      </div>

      {/* Rendered verbatim — the agent writes this to be constructive, and it
          already reflects whether the shortfall was the resume or our scoring. */}
      {feedback && feedbackProminence !== 'hidden' && (
        <div className={`rounded-2xl p-5 flex gap-3 ${
          feedbackProminence === 'subtle'
            ? 'bg-surface-container-low border border-outline-variant/60'
            : 'bg-tertiary-container/40 border border-tertiary/30'
        }`}>
          <span className="material-symbols-outlined text-tertiary shrink-0 mt-0.5">lightbulb</span>
          <div>
            <p className="font-semibold text-on-surface text-sm mb-1">
              {ourFault ? 'Something went wrong on our side' : 'How to get more matches'}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{feedback}</p>
            {ourFault && (
              <button onClick={onReset} className="mt-3 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 cursor-pointer">
                Run the search again
              </button>
            )}
          </div>
        </div>
      )}

      {result.opportunities.length === 0 ? (
        <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-outline text-[44px]">search_off</span>
          <h3 className="font-bold text-on-surface">No matches this time</h3>
          <p className="text-sm text-on-surface-variant max-w-md">
            Nothing scored high enough against your resume to be worth your time. Browsing Search
            directly may work better while you build out your profile.
          </p>
          <button onClick={onReset} className="mt-1 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 cursor-pointer">
            Try another resume
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {result.opportunities.map((o, i) => <OpportunityCard key={`${o.apply_url}-${i}`} o={o} />)}
        </div>
      )}
    </div>
  )
}

function OpportunityCard({ o }: { o: AgentOpportunity }) {
  // Render what is present, omit what is null. `salary` and `deadline` are
  // rarely populated and a wrong figure is a trust violation, so neither ever
  // gets a placeholder.
  const location = o.location?.display?.trim() || null
  const chips = [o.employment_type, o.work_mode, location].filter(Boolean) as string[]

  return (
    <article className="bg-surface border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <CompanyLogo
          src={null}
          name={o.company}
          alt={`${o.company} logo`}
          containerClassName="w-11 h-11 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shrink-0 overflow-hidden"
          imageClassName="w-6 h-6 object-contain"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-on-background leading-snug">{o.title}</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">{o.company}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-primary leading-none">{o.score}</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wide font-semibold mt-1">Match</div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-container text-on-surface-variant capitalize">
              {c}
            </span>
          ))}
          {o.salary && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary-container text-on-secondary-container">
              {o.salary}
            </span>
          )}
        </div>
      )}

      {o.reasoning && (
        <p className="text-sm text-on-surface-variant leading-relaxed">
          <span className="font-semibold text-on-surface">Why this matched: </span>
          {o.reasoning}
        </p>
      )}

      {o.skills && o.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {o.skills.slice(0, 8).map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-md text-[11px] bg-primary/8 text-primary font-medium">{s}</span>
          ))}
        </div>
      )}

      <a
        href={o.apply_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 self-start px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        Apply now
        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
      </a>
    </article>
  )
}
