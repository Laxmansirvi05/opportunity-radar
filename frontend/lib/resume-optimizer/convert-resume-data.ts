import type { ParsedResume, ResumeEducation, ResumeExperience, ResumeProject } from '@/types/resume'

/**
 * Converts the Resume Builder's format (Reactive Resume's `ResumeData` —
 * `basics`/`summary`/`sections.<name>.items[]`, HTML-formatted descriptions)
 * into the flat `ParsedResume` shape the ATS v2 engine and the optimiser
 * actually score against.
 *
 * `resumes.parsed_data` is stored in `ResumeData` shape (every resume the
 * builder or "Upload PDF" path produces is that shape) — both
 * `/api/resume/optimization` and `/api/resume/ats-check` were casting it
 * straight to `ParsedResume` with no conversion, so the AI was scoring
 * against an object with `name`/`skills`/`experience` all `undefined`.
 * That is not a cosmetic bug: the evidence evaluator has essentially nothing
 * to evaluate, so every requirement reads as unmet regardless of what the
 * student actually put on their resume.
 */

// ── HTML → plain text ───────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

/** Strips HTML to plain text, keeping paragraph/list-item boundaries as newlines. */
function htmlToText(html: string | undefined | null): string {
  if (!html) return ''
  const withBreaks = html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
  const stripped = withBreaks.replace(/<[^>]+>/g, '')
  return decodeEntities(stripped)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

/** Same, but returns each line as a separate bullet (bullet marker stripped). */
function htmlToBullets(html: string | undefined | null): string[] {
  const text = htmlToText(html)
  if (!text) return []
  return text.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean)
}

// ── Small structured-field parsers ──────────────────────────────────────────

function splitPeriod(period: string | undefined | null): { start: string; end?: string } {
  const trimmed = (period ?? '').trim()
  if (!trimmed) return { start: '' }
  const parts = trimmed.split(/\s*[-–—]\s*|\s+to\s+/i).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return { start: parts[0], end: parts[1] }
  return { start: trimmed }
}

function classifyDegreeLevel(degree: string): ResumeEducation['degree_level'] {
  const d = degree.toLowerCase()
  if (/ph\.?d|doctorate/.test(d)) return 'doctorate'
  if (/\bm\.?tech\b|\bmaster|\bm\.?sc\b|\bmba\b|\bm\.?a\.?\b|\bm\.?s\.?\b/.test(d)) return 'masters'
  if (/\bb\.?tech\b|\bbachelor|\bb\.?sc\b|\bb\.?e\.?\b|\bb\.?a\.?\b|\bb\.?s\.?\b/.test(d)) return 'bachelors'
  if (/diploma/.test(d)) return 'diploma'
  return 'other'
}

function parseGraduationYear(period: string | undefined | null): number | undefined {
  const matches = (period ?? '').match(/(19|20)\d{2}/g)
  if (!matches) return undefined
  const year = parseInt(matches[matches.length - 1], 10)
  return year >= 1990 && year <= 2040 ? year : undefined
}

/** Only sets a GPA when the source text is unambiguously a 0-10 scale value
 *  (e.g. "9.28/10") — a percentage like "94.2%" is not a GPA, and converting
 *  it would be inventing a number that was not on the resume. */
function parseGpaOutOfTen(grade: string | undefined | null): number | undefined {
  const text = (grade ?? '').trim()
  if (!text) return undefined
  const outOfTen = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10\b/)
  if (outOfTen) return Math.min(10, parseFloat(outOfTen[1]))
  const bare = text.match(/^(\d+(?:\.\d+)?)$/)
  if (bare) {
    const val = parseFloat(bare[1])
    if (val >= 0 && val <= 10) return val
  }
  return undefined
}

// ── Item converters ──────────────────────────────────────────────────────

interface RDExperienceItem {
  company?: string
  position?: string
  location?: string
  period?: string
  description?: string
  roles?: { position?: string; period?: string; description?: string }[]
}

function convertExperience(items: RDExperienceItem[] | undefined): ResumeExperience[] {
  return (items ?? [])
    .filter((item) => item.company)
    .map((item) => {
      const { start, end } = splitPeriod(item.period)
      const bullets = htmlToBullets(item.description)
      for (const role of item.roles ?? []) {
        bullets.push(...htmlToBullets(role.description))
      }
      return {
        company: item.company!,
        role: item.position || item.roles?.[0]?.position || 'Team Member',
        start_date: start || 'Unknown',
        end_date: end,
        location: item.location || undefined,
        bullets,
      }
    })
}

interface RDProjectItem {
  name?: string
  description?: string
}

function convertProjects(items: RDProjectItem[] | undefined): ResumeProject[] {
  return (items ?? [])
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name!,
      description: htmlToText(item.description) || undefined,
      // No dedicated technologies field in the builder's project schema — the
      // description text (carried above) is what the evidence evaluator
      // actually reads, so nothing is lost by leaving this empty rather than
      // guessing keywords out of prose.
      technologies: [],
    }))
}

interface RDEducationItem {
  school?: string
  degree?: string
  area?: string
  grade?: string
  period?: string
}

function convertEducation(items: RDEducationItem[] | undefined): ResumeEducation[] {
  return (items ?? [])
    .filter((item) => item.school)
    .map((item) => ({
      institution: item.school!,
      degree: item.degree || 'Unspecified',
      degree_level: classifyDegreeLevel(item.degree || ''),
      field: item.area || undefined,
      graduation_year: parseGraduationYear(item.period),
      gpa: parseGpaOutOfTen(item.grade),
    }))
}

function convertSkills(items: { name?: string; keywords?: string[] }[] | undefined): string[] {
  const names = new Set<string>()
  for (const item of items ?? []) {
    if (item.name) names.add(item.name.trim())
    for (const kw of item.keywords ?? []) {
      if (kw) names.add(kw.trim())
    }
  }
  return [...names].filter(Boolean)
}

function findProfileUrl(
  profiles: { network?: string; website?: { url?: string } }[] | undefined,
  networkMatch: RegExp
): string | undefined {
  const hit = (profiles ?? []).find((p) => p.network && networkMatch.test(p.network))
  return hit?.website?.url || undefined
}

function convertCertifications(items: { title?: string; issuer?: string }[] | undefined): string[] {
  return (items ?? [])
    .filter((item) => item.title)
    .map((item) => (item.issuer ? `${item.title} (${item.issuer})` : item.title!))
}

function convertAwards(items: { title?: string; description?: string }[] | undefined): string[] {
  return (items ?? [])
    .filter((item) => item.title)
    .map((item) => {
      const detail = htmlToText(item.description)
      return detail ? `${item.title} — ${detail}` : item.title!
    })
}

// ── Entry point ──────────────────────────────────────────────────────────

/** Loosely typed on purpose: this crosses the Reactive Resume package's own
 *  schema, and every field here is read defensively rather than assumed
 *  present, since the input may be older data or partially filled in. */
export function convertResumeDataToParsedResume(data: Record<string, unknown>): ParsedResume {
  const basics = (data.basics ?? {}) as { name?: string; email?: string; phone?: string; website?: { url?: string } }
  const summary = (data.summary ?? {}) as { content?: string }
  const sections = (data.sections ?? {}) as Record<string, { items?: unknown[] }>

  const name = basics.name?.trim()

  return {
    name: name && name.length > 0 ? name : 'Unknown Candidate',
    email: basics.email || undefined,
    phone: basics.phone || undefined,
    linkedin: findProfileUrl(sections.profiles?.items as never, /linkedin/i) || undefined,
    github: findProfileUrl(sections.profiles?.items as never, /github/i) || undefined,
    summary: htmlToText(summary.content) || undefined,
    skills: convertSkills(sections.skills?.items as never),
    experience: convertExperience(sections.experience?.items as never),
    projects: convertProjects(sections.projects?.items as never),
    education: convertEducation(sections.education?.items as never),
    certifications: convertCertifications(sections.certifications?.items as never),
    achievements: convertAwards(sections.awards?.items as never),
  }
}

/**
 * True when an object already looks like a flat `ParsedResume` (has a plain
 * `name` string at the top level) rather than the builder's nested
 * `basics`/`sections` shape. Lets callers accept either without guessing
 * wrong — a resume already in the right shape must not be run through the
 * converter, which would read `data.name` as missing and produce garbage.
 */
export function looksLikeParsedResume(data: Record<string, unknown>): boolean {
  return typeof data.name === 'string' && !('basics' in data) && !('sections' in data)
}
