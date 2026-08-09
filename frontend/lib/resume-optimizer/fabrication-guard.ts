import type { ParsedResume } from '@/types/resume'

/**
 * Verifies a generated resume invented nothing.
 *
 * A model asked to "improve" a resume will, unprompted, add a company it thinks
 * fits, round a GPA up, or turn "helped with" into "led". On a job application
 * that is not a stylistic liberty — it is a false statement the student will be
 * asked to defend in an interview, and cannot.
 *
 * So generation output is checked rather than trusted. The polished resume must
 * contain exactly the same employers, institutions, degrees, dates and numbers
 * as the source. Wording may change freely; facts may not.
 *
 * The target resume is checked with an allowlist of the specific items the
 * student confirmed they completed — nothing else may appear.
 */

export interface FabricationFinding {
  kind: 'company' | 'institution' | 'degree' | 'date' | 'metric' | 'section_growth'
  detail: string
  value: string
}

export interface FabricationVerdict {
  clean: boolean
  findings: FabricationFinding[]
}

const norm = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Every number that reads as a claim: percentages, counts, money, multipliers. */
export function extractMetrics(text: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /\b\d[\d,]*\s?%/g,           // 30%, 1,200 %
    /[₹$€£]\s?\d[\d,.]*\s?[kmb]?\b/gi, // ₹50,000  $1.2M
    /\b\d[\d,]{2,}\b/g,          // 85,000  1200
    /\b\d+(?:\.\d+)?\s?x\b/gi,   // 3x, 2.5x
  ]
  for (const p of patterns) {
    for (const m of text.match(p) ?? []) found.add(m.replace(/\s+/g, '').toLowerCase())
  }
  return [...found]
}

function allText(resume: ParsedResume): string {
  const parts: string[] = [resume.summary ?? '']
  for (const e of resume.experience ?? []) parts.push(e.role, e.company, ...(e.bullets ?? []))
  for (const p of resume.projects ?? []) parts.push(p.name, p.description ?? '', ...(p.technologies ?? []))
  for (const ed of resume.education ?? []) parts.push(ed.institution, ed.degree, ed.field ?? '')
  return parts.join(' \n ')
}

/**
 * @param source    the resume as uploaded
 * @param generated the model's output
 * @param allowed   items the student confirmed completing (target resume only).
 *                  Names here may legitimately appear as new projects.
 */
export function verifyNoFabrication(
  source: ParsedResume,
  generated: ParsedResume,
  allowed: { projects?: string[]; skills?: string[] } = {}
): FabricationVerdict {
  const findings: FabricationFinding[] = []

  // ── Employers ─────────────────────────────────────────────────────────
  // A new employer is the most damaging possible fabrication.
  const sourceCompanies = new Set((source.experience ?? []).map((e) => norm(e.company)))
  for (const exp of generated.experience ?? []) {
    if (!sourceCompanies.has(norm(exp.company))) {
      findings.push({
        kind: 'company',
        detail: 'An employer appears that is not on the original resume',
        value: exp.company,
      })
    }
  }

  // ── Institutions and degrees ──────────────────────────────────────────
  const sourceInstitutions = new Set((source.education ?? []).map((e) => norm(e.institution)))
  const sourceDegrees = new Set((source.education ?? []).map((e) => norm(e.degree)))
  for (const ed of generated.education ?? []) {
    if (!sourceInstitutions.has(norm(ed.institution))) {
      findings.push({ kind: 'institution', detail: 'An institution appears that is not on the original resume', value: ed.institution })
    }
    if (!sourceDegrees.has(norm(ed.degree))) {
      findings.push({ kind: 'degree', detail: 'A qualification appears that is not on the original resume', value: ed.degree })
    }
  }

  // ── Employment dates ──────────────────────────────────────────────────
  // Extending a tenure to look better is subtle and checkable.
  const sourceDates = new Map(
    (source.experience ?? []).map((e) => [norm(e.company), `${e.start_date}|${e.end_date ?? ''}`])
  )
  for (const exp of generated.experience ?? []) {
    const original = sourceDates.get(norm(exp.company))
    const now = `${exp.start_date}|${exp.end_date ?? ''}`
    if (original && original !== now) {
      findings.push({
        kind: 'date',
        detail: `Dates for ${exp.company} were changed from ${original.replace('|', ' – ')}`,
        value: now.replace('|', ' – '),
      })
    }
  }

  // ── Invented metrics ──────────────────────────────────────────────────
  // "Improved performance" becoming "improved performance by 40%" is the single
  // most common embellishment, and it is exactly what an interviewer probes.
  const sourceMetrics = new Set(extractMetrics(allText(source)))
  for (const metric of extractMetrics(allText(generated))) {
    if (!sourceMetrics.has(metric)) {
      findings.push({
        kind: 'metric',
        detail: 'A number appears that was not in the original resume',
        value: metric,
      })
    }
  }

  // ── New projects ──────────────────────────────────────────────────────
  // Permitted only when the student confirmed building it.
  const sourceProjects = new Set((source.projects ?? []).map((p) => norm(p.name)))
  const allowedProjects = new Set((allowed.projects ?? []).map(norm))
  for (const p of generated.projects ?? []) {
    const key = norm(p.name)
    if (sourceProjects.has(key)) continue
    // An allowed item matches if the confirmed requirement appears in the name,
    // since the model titles the project itself.
    const isAllowed = [...allowedProjects].some((a) => a.length > 0 && (key.includes(a) || a.includes(key)))
    if (!isAllowed) {
      findings.push({
        kind: 'section_growth',
        detail: 'A project appears that is neither on the original resume nor confirmed as completed',
        value: p.name,
      })
    }
  }

  // ── New skills ────────────────────────────────────────────────────────
  const sourceSkills = new Set((source.skills ?? []).map(norm))
  const allowedSkills = new Set((allowed.skills ?? []).map(norm))
  for (const skill of generated.skills ?? []) {
    const key = norm(skill)
    if (sourceSkills.has(key) || allowedSkills.has(key)) continue
    // A skill already demonstrated in the source text is a surfacing, not an
    // invention — parsers routinely miss skills that the prose clearly shows.
    if (norm(allText(source)).includes(key)) continue
    findings.push({
      kind: 'section_growth',
      detail: 'A skill appears that is neither on the original resume nor confirmed as learned',
      value: skill,
    })
  }

  return { clean: findings.length === 0, findings }
}

/** One-line summary for logs and stored run metadata. */
export function describeFindings(verdict: FabricationVerdict): string {
  if (verdict.clean) return 'no fabricated content detected'
  return verdict.findings.map((f) => `${f.kind}: "${f.value}"`).join('; ')
}
