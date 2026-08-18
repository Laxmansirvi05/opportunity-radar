'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PERSONAS, DEFAULT_PERSONA_ID, type PersonaId } from '../lib/personas'
import { MicCheck } from './mic-check'

interface OpportunityContext {
  id: string
  title: string
  company: string | null
  description?: string | null
}

interface SavedResume {
  id: string
  title: string
  updated_at: string
}

interface InterviewStartProps {
  opportunity: OpportunityContext | null
  resumes: SavedResume[]
}

type Step = 'resume' | 'role' | 'style'

const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'resume', label: 'Your resume', hint: 'What the interviewer reads before the call' },
  { id: 'role', label: 'The role', hint: 'What the questions are actually about' },
  { id: 'style', label: 'Interviewer', hint: 'Who you practise against' },
]

const JD_MIN = 40

/**
 * The mock-interview intake.
 *
 * Three deliberate steps rather than one card, because the agent's own
 * /api/prep marks `jd_text` and `company` required: an interview without them
 * is a generic one, and the old single-button screen had no way to supply
 * either. Each step is answerable on its own, and the summary rail on the
 * right shows exactly what the interviewer will be given — no hidden inputs.
 */
export function InterviewStart({ opportunity, resumes }: InterviewStartProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>('resume')
  const [resumeId, setResumeId] = useState<string | null>(resumes[0]?.id ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState<string | null>(null)
  // The extracted resume itself, sent with the start request for this run only.
  const [uploadedResume, setUploadedResume] = useState<unknown>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [role, setRole] = useState(opportunity?.title ?? '')
  const [company, setCompany] = useState(opportunity?.company ?? '')
  const [jobDescription, setJobDescription] = useState(opportunity?.description ?? '')

  const [personaId, setPersonaId] = useState<PersonaId>(DEFAULT_PERSONA_ID)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]
  const hasResume = Boolean(resumeId) || Boolean(uploadName)
  const jdReady = jobDescription.trim().length >= JD_MIN
  const canStart = hasResume && role.trim().length > 0 && company.trim().length > 0 && jdReady

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/resume/optimization/extract', { method: 'POST', body: form })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Could not read that file')
      // Keep the extracted resume, don't just note the filename. This response
      // used to be thrown away, so an upload set a label and nothing else: the
      // screen enabled Start and the request then failed with NO_RESUME,
      // because the server went looking for a *saved* resume the student did
      // not have. The extracted structure is what actually gets interviewed.
      if (!body?.resume) throw new Error('Could not read that file')
      setUploadedResume(body.resume)
      setUploadName(file.name)
      // An uploaded CV is used for this run only; a saved resume still wins if
      // one is selected, so the two sources never silently disagree.
      setResumeId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file')
    } finally {
      setUploading(false)
    }
  }

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunity?.id,
          resume_id: resumeId ?? undefined,
          resume_upload: uploadedResume ?? undefined,
          role: role.trim(),
          company: company.trim(),
          job_description: jobDescription.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not start the interview')
      router.push(`/interview/${body.session_id}?persona=${personaId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the interview')
      setStarting(false)
    }
  }

  return (
    // A single content measure the whole page shares. The header, the steps and
    // the panel all align to the same left edge and the same right edge, which
    // is most of what stops a wide desktop reading as a narrow column adrift in
    // grey.
    <div className="interview-shell mx-auto flex w-full max-w-[1180px] flex-col px-6 py-8 xl:max-w-[1320px] xl:px-8">
      <header className="interview-hero relative mb-6 overflow-hidden rounded-3xl border border-outline-variant p-6 xl:p-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="interview-eyebrow inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface/70 px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant backdrop-blur">
              <span className="material-symbols-outlined text-[15px]">graphic_eq</span>
              Live voice practice
            </span>
            <h1 className="mt-3 font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
              Mock interview
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">
              A 10–15 minute voice interview run by an AI interviewer that has read your resume and
              the job description. It asks follow-ups when an answer is thin, and afterwards scores
              you on the dimensions it actually observed — never on ones it didn&apos;t.
            </p>
          </div>

          {/* Facts, not decoration — the three things a student wants to know
              before committing fifteen minutes. They also give the header a
              right-hand edge, so the hero fills the width instead of trailing
              off into empty space. */}
          <dl className="grid shrink-0 grid-cols-3 gap-3 lg:w-[340px]">
            {[
              { k: 'Length', v: '10–15', unit: 'min' },
              { k: 'Interviewers', v: String(PERSONAS.length), unit: 'styles' },
              { k: 'Format', v: 'Voice', unit: 'audio only' },
            ].map((stat) => (
              <div key={stat.k} className="interview-stat rounded-2xl border border-outline-variant bg-surface/70 p-3 backdrop-blur">
                <dt className="font-label-sm text-[11px] uppercase tracking-[0.08em] text-on-surface-variant/70">{stat.k}</dt>
                <dd className="mt-1 font-title-md text-title-md font-semibold leading-none text-on-surface">{stat.v}</dd>
                <dd className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">{stat.unit}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Step rail.
              A 3-column grid with stretched rows, not flex-1 in a flex row:
              flex-1 equalises width but lets each box find its own height, so a
              hint that wraps to two lines makes one card visibly taller than its
              neighbours. Equal columns plus h-full makes all three identical
              whatever the copy does. */}
          <ol className="interview-steps grid grid-cols-3 items-stretch gap-3">
            {STEPS.map((s, index) => {
              const active = s.id === step
              const done =
                (s.id === 'resume' && hasResume) ||
                (s.id === 'role' && canStart) ||
                (s.id === 'style' && false)
              return (
                <li key={s.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-current={active ? 'step' : undefined}
                    className={`interview-step group/step flex h-full w-full flex-col rounded-2xl border p-3.5 text-left transition-all duration-300 ease-note ${
                      active
                        ? 'border-primary bg-primary-container/30'
                        : 'border-outline-variant hover:border-primary/40 bg-surface-container-low'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`interview-step-tile grid size-7 shrink-0 place-items-center rounded-lg font-label-sm text-label-sm transition-all duration-300 ease-note ${
                          active || done ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {done ? <span className="material-symbols-outlined text-[15px]">check</span> : index + 1}
                      </span>
                      <span className="font-label-lg text-label-lg truncate text-on-surface">{s.label}</span>
                    </span>
                    {/* Three columns leave ~90px each on a phone, where this
                        hint wraps into a thin ribbon and triples the card's
                        height. The label alone still says what the step is. */}
                    <span className="mt-1.5 hidden font-body-sm text-body-sm text-on-surface-variant sm:block">{s.hint}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* ── Step 1: resume ─────────────────────────────────────────── */}
          {step === 'resume' && (
            <section className="interview-panel flex min-h-[360px] flex-col rounded-3xl border border-outline-variant bg-surface-container-low p-6">
              <h2 className="font-title-md text-title-md text-on-surface">Which resume should it read?</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                The interviewer asks about what&apos;s actually on it — projects, experience, the
                skills you list — so pick the one closest to this role.
              </p>

              {resumes.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {resumes.map((r) => {
                    const selected = r.id === resumeId
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => { setResumeId(r.id); setUploadName(null); setUploadedResume(null) }}
                          className={`interview-card w-full rounded-xl border p-3 text-left transition-all duration-300 ease-note ${
                            selected ? 'border-primary bg-primary-container/25' : 'border-outline-variant hover:border-primary/40 bg-surface'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={`interview-card-tile grid size-9 shrink-0 place-items-center rounded-[10px] transition-all duration-300 ease-note ${
                                selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">description</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-label-lg text-label-lg text-on-surface truncate">
                                {r.title || 'Untitled resume'}
                              </span>
                              <span className="block font-body-sm text-body-sm text-on-surface-variant">
                                Updated {new Date(r.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </span>
                            {selected && <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-outline-variant p-4 font-body-sm text-body-sm text-on-surface-variant">
                  No saved resumes yet. Upload one below, or build one in{' '}
                  <Link href="/resume/builder" className="text-primary underline">Resume Builder</Link>.
                </p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="interview-card flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 font-label-md text-label-md text-on-surface transition-all duration-300 ease-note hover:border-primary/40 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  {uploading ? 'Reading…' : 'Upload a PDF instead'}
                </button>
                {uploadName && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    Using {uploadName}
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }}
                />
              </div>

              <button
                type="button"
                disabled={!hasResume}
                onClick={() => setStep('role')}
                className="interview-cta mt-auto h-11 self-start rounded-full bg-primary px-6 pt-0 font-label-lg text-label-lg text-on-primary transition-transform duration-300 ease-note disabled:opacity-40"
              >
                Next — the role
              </button>
            </section>
          )}

          {/* ── Step 2: role + JD ──────────────────────────────────────── */}
          {step === 'role' && (
            <section className="interview-panel flex min-h-[360px] flex-col rounded-3xl border border-outline-variant bg-surface-container-low p-6">
              <h2 className="font-title-md text-title-md text-on-surface">What are you interviewing for?</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                The job description is what turns this from a generic interview into one about this
                specific job — the interviewer draws its questions from it, and the score afterwards
                is measured against it.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block font-label-md text-label-md text-on-surface">Target role</span>
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Frontend Engineer Intern"
                    maxLength={120}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-label-md text-label-md text-on-surface">Company</span>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme"
                    maxLength={120}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 flex items-center justify-between font-label-md text-label-md text-on-surface">
                  Job description
                  <span className={`font-label-sm text-label-sm ${jdReady ? 'text-on-surface-variant' : 'text-error'}`}>
                    {jobDescription.trim().length < JD_MIN
                      ? `${JD_MIN - jobDescription.trim().length} more characters`
                      : `${jobDescription.trim().length} characters`}
                  </span>
                </span>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={8}
                  maxLength={20000}
                  placeholder="Paste the responsibilities and requirements from the listing."
                  className="w-full resize-y rounded-xl border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
                />
              </label>

              <div className="mt-auto flex items-center gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => setStep('resume')}
                  className="h-10 rounded-full px-4 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={() => setStep('style')}
                  className="h-10 rounded-full bg-primary px-5 font-label-lg text-label-lg text-on-primary disabled:opacity-40"
                >
                  Next — interviewer
                </button>
              </div>
            </section>
          )}

          {/* ── Step 3: persona ────────────────────────────────────────── */}
          {step === 'style' && (
            <section className="interview-panel flex min-h-[360px] flex-col rounded-3xl border border-outline-variant bg-surface-container-low p-6">
              <h2 className="font-title-md text-title-md text-on-surface">Who should interview you?</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Same questions, different pressure. Practising against a tougher voice is useful once
                you&apos;re past the nerves.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PERSONAS.map((p) => {
                  const selected = p.id === personaId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersonaId(p.id)}
                      aria-pressed={selected}
                      className={`interview-card rounded-xl border p-4 text-left transition-all duration-300 ease-note ${
                        selected ? 'border-primary bg-primary-container/25' : 'border-outline-variant hover:border-primary/40 bg-surface'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`interview-card-tile mb-2 grid size-10 place-items-center rounded-xl transition-all duration-300 ease-note ${
                          selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                      </span>
                      <span className="block font-title-sm text-title-sm text-on-surface">{p.name}</span>
                      <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">{p.style}</span>
                    </button>
                  )
                })}
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
                  {error}
                </p>
              )}

              <div className="mt-auto flex items-center gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="h-10 rounded-full px-4 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canStart || starting}
                  onClick={start}
                  className="interview-cta h-11 rounded-full bg-primary px-6 font-label-lg text-label-lg text-on-primary transition-transform duration-300 ease-note disabled:opacity-40"
                >
                  {starting ? 'Setting up…' : `Start interview with ${persona.name}`}
                </button>
              </div>
            </section>
          )}

          {/* Sits under every step rather than inside one: a student who
              discovers their mic is dead should find that out while filling the
              form, not on the call screen with the interviewer already waiting. */}
          <MicCheck />
        </div>

        {/* ── Summary rail ─────────────────────────────────────────────── */}
        <aside className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 lg:sticky lg:top-6">
          <h2 className="font-label-lg text-label-lg text-on-surface-variant uppercase tracking-wide text-[11px]">
            What the interviewer gets
          </h2>
          <dl className="mt-3 flex flex-col gap-3">
            {[
              { k: 'Resume', v: uploadName ?? resumes.find((r) => r.id === resumeId)?.title ?? 'Not chosen yet' },
              { k: 'Role', v: role.trim() || 'Not set' },
              { k: 'Company', v: company.trim() || 'Not set' },
              { k: 'Job description', v: jdReady ? `${jobDescription.trim().length} characters` : 'Needs more detail' },
              { k: 'Interviewer', v: persona.name },
            ].map((row) => (
              <div key={row.k}>
                <dt className="font-label-sm text-label-sm text-on-surface-variant">{row.k}</dt>
                <dd className="font-label-md text-label-md text-on-surface truncate">{row.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant pt-3">
            {[
              { icon: 'mic', text: 'Needs microphone access — test it below before you start' },
              { icon: 'schedule', text: '10–15 minutes, audio only. Typing works if audio fails' },
              { icon: 'insights', text: 'Scored afterwards on strengths, gaps and next steps' },
            ].map((n) => (
              <p key={n.icon} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] mt-0.5">{n.icon}</span>
                {n.text}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
