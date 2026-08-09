import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Resume Optimiser | Resume Toolkit',
}

/**
 * Resume Optimiser — under construction.
 *
 * This route previously rendered a full mockup: a donut chart fixed at 68, a
 * "Last saved 2m ago" line, and a hardcoded gap list. None of it came from the
 * student's resume. A fabricated ATS score is worse than no score, because a
 * student may act on it — so the mockup is gone and this page says plainly
 * where the feature stands.
 *
 * The deterministic layers are already built and tested:
 *   lib/resume-optimizer/tiers.ts             — tier thresholds, gap-derived suggestions
 *   lib/resume-optimizer/fabrication-guard.ts — rejects invented employers, dates, metrics
 *   lib/resume-optimizer/generate.ts          — Resume A and B generation (not yet wired)
 *
 * Remaining: wire generation to a route, score both resumes through
 * calculateAtsV2Score, and add the ATS-safe PDF export.
 */
export default function ResumeOptimiserPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-[40px]">
      <div className="w-full max-w-[560px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 shadow-sm text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">construction</span>
        </div>

        <h1 className="text-[24px] leading-[1.3] font-semibold tracking-[-0.01em] text-on-background mb-3">
          The resume optimiser is still being built
        </h1>

        <p className="text-[14px] leading-[1.6] text-on-surface-variant mb-6">
          It will read your resume against a specific job description, show you your real
          ATS score, and tell you exactly which projects or skills would close the gap.
          It is not ready yet, and we would rather show you nothing than show you a
          number we made up.
        </p>

        <div className="text-left bg-surface-container rounded-xl p-4 mb-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">
            Available today
          </p>
          <ul className="text-[14px] leading-[1.6] text-on-background space-y-1.5">
            <li>
              <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">fact_check</span>
              <strong>ATS Check</strong> — score your resume against a job description
            </li>
            <li>
              <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">edit_document</span>
              <strong>Resume Builder</strong> — build or edit a resume from scratch
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/resume/ats"
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-[14px] hover:opacity-90 transition-opacity"
          >
            Run an ATS check
          </Link>
          <Link
            href="/resume"
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-background font-semibold text-[14px] hover:bg-surface-container transition-colors"
          >
            Back to Resume Toolkit
          </Link>
        </div>
      </div>
    </div>
  )
}
