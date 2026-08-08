/**
 * Batch-level synthetic data detection.
 *
 * Nine of the original thirteen providers did not fetch anything — they built
 * records with `Array.from({length: 25}).map((_, i) => ...)`, producing
 * sequential ids, templated titles like "AI Innovators Hackathon v3", company
 * names like "TechCorp 7", and apply URLs ending in an incrementing integer.
 * Every one of those links was dead.
 *
 * Per-record validation cannot see this: any single fabricated record looks
 * plausible. The tell is only visible across the batch, which is why this runs
 * on the whole provider payload and rejects it *wholesale*.
 *
 * A provider that cannot fetch must return an empty array. Returning invented
 * data is a contract violation, and this is the enforcement.
 */

export interface SyntheticSignal {
  code: string
  detail: string
  /** 0–1. Signals are summed; a batch is rejected at or above THRESHOLD. */
  weight: number
}

export interface SyntheticVerdict {
  isSynthetic: boolean
  score: number
  signals: SyntheticSignal[]
}

export interface CandidateRecord {
  title?: string | null
  company?: string | null
  description?: string | null
  apply_url?: string | null
  source_id?: string | null
}

/** Score at which a batch is treated as fabricated and dropped entirely. */
export const SYNTHETIC_THRESHOLD = 1.0

/** Below this many records the statistical signals are meaningless. */
const MIN_BATCH_FOR_STATS = 5

/** Trailing-integer pattern: "TechCorp 7", "Hackathon v3", "Project 12". */
const TRAILING_INDEX = /^(.*?)[\s_-]*v?(\d{1,4})$/i

function trailingIndexFamily(values: string[]): { stem: string; count: number } | null {
  const families = new Map<string, number>()
  for (const v of values) {
    const m = TRAILING_INDEX.exec(v.trim())
    if (!m) continue
    const stem = m[1].trim().toLowerCase()
    if (stem.length < 3) continue
    families.set(stem, (families.get(stem) ?? 0) + 1)
  }
  let best: { stem: string; count: number } | null = null
  for (const [stem, count] of families) {
    if (!best || count > best.count) best = { stem, count }
  }
  return best
}

/** Trailing integers from a list of strings, in order, when present. */
function trailingNumbers(values: string[]): number[] {
  const out: number[] = []
  for (const v of values) {
    const m = /(\d{2,})\s*$/.exec(v.trim())
    if (m) out.push(Number(m[1]))
  }
  return out
}

/**
 * True when the numbers form a near-perfect arithmetic run (1000, 1001, 1002…).
 * Real job boards allocate ids with gaps; generated ones never do.
 */
function isContiguousRun(nums: number[]): boolean {
  if (nums.length < MIN_BATCH_FOR_STATS) return false
  const sorted = [...nums].sort((a, b) => a - b)
  let steps = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) steps++
  }
  return steps / (sorted.length - 1) >= 0.9
}

export function detectSynthetic(records: CandidateRecord[]): SyntheticVerdict {
  const signals: SyntheticSignal[] = []
  const n = records.length

  if (n === 0) return { isSynthetic: false, score: 0, signals }

  if (n >= MIN_BATCH_FOR_STATS) {
    // ── 1. Sequential source ids ──────────────────────────────────────────
    const idNums = trailingNumbers(records.map((r) => String(r.source_id ?? '')))
    if (idNums.length >= n * 0.9 && isContiguousRun(idNums)) {
      signals.push({
        code: 'sequential_source_ids',
        detail: `${idNums.length}/${n} source ids form a contiguous run (${Math.min(...idNums)}…${Math.max(...idNums)})`,
        weight: 0.7,
      })
    }

    // ── 2. Sequential apply-URL paths ─────────────────────────────────────
    const urlNums = trailingNumbers(
      records.map((r) => (r.apply_url ?? '').replace(/[/?#].*$/, (m) => m).replace(/[?#].*$/, ''))
    )
    if (urlNums.length >= n * 0.9 && isContiguousRun(urlNums)) {
      signals.push({
        code: 'sequential_apply_urls',
        detail: `${urlNums.length}/${n} apply URLs end in a contiguous integer run`,
        weight: 0.6,
      })
    }

    // ── 3. Identical description text ─────────────────────────────────────
    const descs = records.map((r) => (r.description ?? '').trim()).filter((d) => d.length > 0)
    if (descs.length >= MIN_BATCH_FOR_STATS) {
      const counts = new Map<string, number>()
      for (const d of descs) counts.set(d, (counts.get(d) ?? 0) + 1)
      const maxDup = Math.max(...counts.values())
      if (maxDup / descs.length >= 0.5) {
        signals.push({
          code: 'identical_descriptions',
          detail: `${maxDup}/${descs.length} records share one identical description`,
          weight: 0.7,
        })
      }
    }

    // ── 4. Templated company names ────────────────────────────────────────
    const companies = records.map((r) => (r.company ?? '').trim()).filter(Boolean)
    const companyFamily = trailingIndexFamily(companies)
    if (companyFamily && companyFamily.count / Math.max(companies.length, 1) >= 0.6) {
      signals.push({
        code: 'templated_company_names',
        detail: `${companyFamily.count} companies match the pattern "${companyFamily.stem} <n>"`,
        weight: 0.8,
      })
    }

    // ── 5. Templated titles ───────────────────────────────────────────────
    const titles = records.map((r) => (r.title ?? '').trim()).filter(Boolean)
    const titleFamily = trailingIndexFamily(titles)
    if (titleFamily && titleFamily.count / Math.max(titles.length, 1) >= 0.8) {
      signals.push({
        code: 'templated_titles',
        detail: `${titleFamily.count} titles match the pattern "${titleFamily.stem} <n>"`,
        weight: 0.5,
      })
    }

    // ── 6. Placeholder company names ──────────────────────────────────────
    // Anchored to the WHOLE name (optionally followed by an index), not a
    // substring. "Acme Renewables" and "Acme Solar Pvt Ltd" are real Indian
    // companies; only a bare "Acme" or "TechCorp 3" is a placeholder.
    //
    // Also gated behind the batch-size threshold. Wrongly dropping a genuine
    // employer is worse than letting a fabricated one through here, because the
    // link-verification gate rejects fabricated listings anyway on their dead URLs.
    const PLACEHOLDER_NAME =
      /^(techcorp|acme(\s+corp(oration)?)?|example(\s+corp)?|foo ?bar|test\s+company|dummy|placeholder|sample\s+company|lorem\s+ipsum)([\s_-]*\d{1,4})?$/i
    const placeholders = records.filter((r) => PLACEHOLDER_NAME.test((r.company ?? '').trim())).length
    if (placeholders / n >= 0.3) {
      signals.push({
        code: 'placeholder_vocabulary',
        detail: `${placeholders}/${n} records use a placeholder company name`,
        weight: 1.0,
      })
    }
  }

  const score = signals.reduce((sum, s) => sum + s.weight, 0)
  return { isSynthetic: score >= SYNTHETIC_THRESHOLD, score, signals }
}

/** One-line summary for logs and ingestion_logs.error_message. */
export function describeVerdict(v: SyntheticVerdict): string {
  if (!v.signals.length) return 'no synthetic signals'
  return `score ${v.score.toFixed(2)} — ` + v.signals.map((s) => `${s.code} (${s.detail})`).join('; ')
}
