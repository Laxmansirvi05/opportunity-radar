'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchCertificationsPage } from '@/features/certifications/services/certification-search'
import {
  CertificationCard,
  CertificationDetailModal,
  type Certification,
} from '@/features/certifications/components/certification-card'
import {
  selectCertificationTargets,
  pickBestCertification,
} from '@/lib/ats-checker/certification-targets'
import type { GapSuggestion } from '@/features/resume-toolkit/lib/schema/resume/ats-check'

/**
 * Certifications that close the gaps this analysis actually found.
 *
 * Each card is tied to one unmet JD requirement, so the student can see why
 * it is being suggested rather than being handed a generic "recommended
 * courses" shelf. How many appear follows `suggestionCountForScore` — the
 * same score-scaled budget the gap checklist already uses, so a nearly-ready
 * resume gets one or two and a struggling one gets a real plan — capped so
 * this never becomes a wall of cards.
 *
 * Everything shown is a real row from the certifications catalogue, matched
 * by searching it for the requirement's name. A requirement with no genuine
 * match is simply skipped: an invented course would be worse than none.
 */

/** Fetched per requirement, then ranked down to at most one card. */
const CANDIDATES_PER_REQUIREMENT = 12

function introForScore(score: number): string {
  if (score >= 80) {
    return 'Your resume already covers most of this role. These close the last gaps the analysis found.'
  }
  if (score >= 65) {
    return 'A few requirements are only partly evidenced. Finishing one of these gives you something concrete to list against them.'
  }
  if (score >= 50) {
    return 'Several requirements have no evidence on your resume yet. These are the shortest routes to covering them.'
  }
  return 'This role asks for a good deal your resume does not evidence yet. Working through these builds the missing ground — take them one at a time.'
}

export function RecommendedCertifications({
  suggestions,
  score,
}: {
  suggestions: GapSuggestion[]
  score: number
}) {
  const [matches, setMatches] = useState<{ requirement: string; certification: Certification }[]>([])
  const [settled, setSettled] = useState(false)
  const [selected, setSelected] = useState<Certification | null>(null)

  // Which requirements to search for, and how many — see
  // selectCertificationTargets for why the count follows the gap checklist.
  const requirements = useMemo(
    () => selectCertificationTargets(suggestions, score),
    [suggestions, score]
  )

  useEffect(() => {
    if (requirements.length === 0) return

    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const results = await Promise.all(
          requirements.map((requirement) =>
            // Several candidates, not one: the catalogue search is loose and
            // unranked, so the best match is chosen here rather than trusting
            // whichever row happened to sort first.
            fetchCertificationsPage(
              supabase,
              { query: requirement, price: 'all', levels: [], providers: [] },
              0,
              CANDIDATES_PER_REQUIREMENT
            )
              .then((page) => ({
                requirement,
                certification: pickBestCertification(page.data, requirement),
              }))
              // One failed lookup must not blank the whole section.
              .catch(() => ({ requirement, certification: null }))
          )
        )
        if (cancelled) return

        const seenIds = new Set<string>()
        setMatches(
          results.flatMap(({ requirement, certification }) => {
            if (!certification || seenIds.has(certification.id)) return []
            seenIds.add(certification.id)
            return [{ requirement, certification }]
          })
        )
      } finally {
        if (!cancelled) setSettled(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [requirements])

  // Derived rather than held in state: with no requirements to look up
  // there is nothing to wait for, and setting a flag for that synchronously
  // inside the effect would just cascade a render.
  const loading = requirements.length > 0 && !settled

  // Nothing to show is a real outcome here — say nothing rather than
  // occupying the page with an empty shelf.
  if (!loading && matches.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-semibold tracking-tight">Certifications that close these gaps</h3>
        <Link href="/certifications" className="text-sm font-medium text-primary hover:underline">
          Browse all certifications
        </Link>
      </div>

      <p className="text-sm text-on-surface-variant leading-relaxed">{introForScore(score)}</p>

      {loading ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          {requirements.map((r) => (
            <div key={r} className="h-[86px] rounded-lg border border-outline-variant bg-surface-container/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map(({ requirement, certification }) => (
            <div key={certification.id} className="flex flex-col gap-1">
              <p className="text-xs text-on-surface-variant">
                Covers <span className="font-semibold text-on-surface">{requirement}</span>
              </p>
              <CertificationCard certification={certification} onSelect={setSelected} />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <CertificationDetailModal certification={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
