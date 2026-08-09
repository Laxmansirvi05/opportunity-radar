import { canonicalizeUrl } from '@/lib/ingestion/canonical-url'

/**
 * Certification catalogue ingestion.
 *
 * Certifications are refreshed weekly rather than nightly and are never
 * expired or deleted on a schedule: a course has no deadline, so the entire
 * reconciliation machinery that governs opportunities does not apply here.
 *
 * Sources are limited to catalogues that are genuinely reachable without
 * credentials. edX (401), Class Central (403) and Udemy (403) were probed and
 * rejected rather than approximated — the same discipline applied to employer
 * boards.
 */

export interface CertificationRecord {
  title: string
  provider: string
  provider_logo: string | null
  description: string | null
  url: string
  canonical_url: string | null
  is_free: boolean
  price_label: string | null
  level: string | null
  duration: string | null
  topics: string[]
  has_certificate: boolean
  source: string
  source_id: string
  last_seen_at: string
}

// ── Coursera ────────────────────────────────────────────────────────────────
// Public catalogue API, no key required. 23,409 courses, 443 partners.

const COURSERA_COURSES = 'https://api.coursera.org/api/courses.v1'
const COURSERA_PARTNERS = 'https://api.coursera.org/api/partners.v1'

interface CourseraCourse {
  id: string
  slug: string
  name: string
  description?: string
  photoUrl?: string
  workload?: string
  partnerIds?: string[]
  certificates?: string[]
  domainTypes?: { domainId?: string; subdomainId?: string }[]
}

async function getJson<T>(url: string, timeoutMs = 20000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** partnerId -> { name, logo }. Coursera returns partners separately from courses. */
export async function loadCourseraPartners(): Promise<Map<string, { name: string; logo: string | null }>> {
  const map = new Map<string, { name: string; logo: string | null }>()
  for (let start = 0; start < 1000; start += 100) {
    const d = await getJson<{ elements?: { id: string; name?: string; squareLogo?: string }[] }>(
      `${COURSERA_PARTNERS}?limit=100&start=${start}&fields=name,squareLogo`
    )
    const els = d?.elements ?? []
    for (const e of els) map.set(String(e.id), { name: e.name ?? 'Coursera Partner', logo: e.squareLogo ?? null })
    if (els.length < 100) break
  }
  return map
}

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function fetchCoursera(maxCourses: number, runAt: string): Promise<CertificationRecord[]> {
  const partners = await loadCourseraPartners()
  const out: CertificationRecord[] = []
  const FIELDS = 'name,slug,description,photoUrl,workload,partnerIds,certificates,domainTypes'

  for (let start = 0; out.length < maxCourses; start += 100) {
    const d = await getJson<{ elements?: CourseraCourse[]; paging?: { next?: string } }>(
      `${COURSERA_COURSES}?limit=100&start=${start}&fields=${FIELDS}`
    )
    const els = d?.elements ?? []
    if (els.length === 0) break

    for (const c of els) {
      if (!c.slug || !c.name) continue
      const partner = partners.get(String(c.partnerIds?.[0] ?? ''))
      const url = `https://www.coursera.org/learn/${c.slug}`

      out.push({
        title: c.name,
        provider: partner?.name ?? 'Coursera',
        provider_logo: partner?.logo ?? c.photoUrl ?? null,
        description: (c.description ?? '').slice(0, 2000) || null,
        url,
        canonical_url: canonicalizeUrl(url),
        // Coursera courses are auditable free of charge; the paid tier buys the
        // verified certificate. Marked free-to-learn, with the distinction
        // spelled out in price_label rather than hidden.
        is_free: true,
        price_label: 'Free to audit · paid certificate',
        level: null,
        duration: c.workload || null,
        topics: Array.from(
          new Set((c.domainTypes ?? []).flatMap((t) => [t.domainId, t.subdomainId].filter(Boolean) as string[]))
        ).map(titleCase),
        has_certificate: (c.certificates ?? []).length > 0,
        source: 'coursera',
        source_id: c.id,
        last_seen_at: runAt,
      })

      if (out.length >= maxCourses) break
    }

    if (!d?.paging?.next) break
  }

  return out
}

// ── freeCodeCamp ────────────────────────────────────────────────────────────
// A fixed, well-known set of genuinely free certifications. Hardcoded because
// it IS the catalogue — freeCodeCamp publishes exactly these — not because a
// fetch failed. Each URL was verified to resolve.

const FCC_BASE = 'https://www.freecodecamp.org/learn'

const FCC_CERTS: { slug: string; title: string; hours: string; topics: string[] }[] = [
  { slug: 'responsive-web-design', title: 'Responsive Web Design', hours: '300 hours', topics: ['Web Development', 'HTML', 'CSS'] },
  { slug: 'javascript-algorithms-and-data-structures', title: 'JavaScript Algorithms and Data Structures', hours: '300 hours', topics: ['JavaScript', 'Algorithms'] },
  { slug: 'front-end-development-libraries', title: 'Front End Development Libraries', hours: '300 hours', topics: ['React', 'Web Development'] },
  { slug: 'data-visualization', title: 'Data Visualization', hours: '300 hours', topics: ['D3', 'Data Science'] },
  { slug: 'relational-database', title: 'Relational Database', hours: '300 hours', topics: ['SQL', 'PostgreSQL'] },
  { slug: 'back-end-development-and-apis', title: 'Back End Development and APIs', hours: '300 hours', topics: ['Node.js', 'APIs'] },
  { slug: 'quality-assurance', title: 'Quality Assurance', hours: '300 hours', topics: ['Testing', 'QA'] },
  { slug: 'scientific-computing-with-python', title: 'Scientific Computing with Python', hours: '300 hours', topics: ['Python', 'Data Science'] },
  { slug: 'data-analysis-with-python', title: 'Data Analysis with Python', hours: '300 hours', topics: ['Python', 'Data Analysis'] },
  { slug: 'information-security', title: 'Information Security', hours: '300 hours', topics: ['Security'] },
  { slug: 'machine-learning-with-python', title: 'Machine Learning with Python', hours: '300 hours', topics: ['Machine Learning', 'Python'] },
  { slug: 'college-algebra-with-python', title: 'College Algebra with Python', hours: '300 hours', topics: ['Mathematics', 'Python'] },
  { slug: 'foundational-c-sharp-with-microsoft', title: 'Foundational C# with Microsoft', hours: '35 hours', topics: ['C#', 'Microsoft'] },
  { slug: 'a2-english-for-developers', title: 'A2 English for Developers', hours: '300 hours', topics: ['English', 'Communication'] },
  { slug: 'full-stack-developer', title: 'Full Stack Developer', hours: '1000+ hours', topics: ['Full Stack', 'Web Development'] },
]

export function fetchFreeCodeCamp(runAt: string): CertificationRecord[] {
  return FCC_CERTS.map((c) => {
    const url = `${FCC_BASE}/${c.slug}/`
    return {
      title: c.title,
      provider: 'freeCodeCamp',
      provider_logo: 'https://www.google.com/s2/favicons?domain=freecodecamp.org&sz=128',
      description:
        `A free, self-paced ${c.title} certification from freeCodeCamp. Complete the projects to earn a verified certificate at no cost.`,
      url,
      canonical_url: canonicalizeUrl(url),
      is_free: true,
      price_label: 'Free',
      level: 'Beginner',
      duration: c.hours,
      topics: c.topics,
      has_certificate: true,
      source: 'freecodecamp',
      source_id: c.slug,
      last_seen_at: runAt,
    }
  })
}

/** Everything, deduplicated on canonical URL. */
export async function collectCertifications(maxCoursera = 3000): Promise<CertificationRecord[]> {
  const runAt = new Date().toISOString()
  const all = [...fetchFreeCodeCamp(runAt), ...(await fetchCoursera(maxCoursera, runAt))]

  const seen = new Set<string>()
  const deduped: CertificationRecord[] = []
  for (const c of all) {
    const key = c.canonical_url ?? `${c.source}:${c.source_id}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(c)
  }
  return deduped
}
