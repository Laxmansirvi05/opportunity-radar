import { canonicalizeUrl } from '@/lib/ingestion/canonical-url'
import { fetchWithRetry } from '@/src/providers/opportunities/utils/fetchWithRetry'
import * as cheerio from 'cheerio'

/**
 * Certification catalogue ingestion.
 *
 * Certifications are refreshed weekly rather than nightly and are never
 * expired or deleted on a schedule: a course has no deadline, so the entire
 * reconciliation machinery that governs opportunities does not apply here.
 *
 * Sources are limited to catalogues that are genuinely reachable without
 * credentials. edX (401), Class Central (403) and Udemy (403 — public course
 * pages, robots.txt, and sitemap all return 403, re-verified 11 Aug 2026)
 * were probed and rejected rather than approximated — the same discipline
 * applied to employer boards.
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

/**
 * The app's CSP only permits `img-src ... https:` — Coursera's partner API
 * returns a real number of logo URLs as plain `http://`, which the browser
 * silently blocks rather than downgrading. Same S3 bucket, same asset;
 * upgrading the scheme is safe and fixes the image without touching what
 * it points to.
 */
function toHttps(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url
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
        provider_logo: toHttps(partner?.logo ?? c.photoUrl ?? null),
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

// ── Microsoft Learn ─────────────────────────────────────────────────────────
// Official public Catalog API (learn.microsoft.com/api/catalog) — no key
// required, documented, used by Microsoft's own site. Two distinct kinds:
// paid-exam "certifications" (has_certificate true — passing the exam IS the
// credential) and free self-paced "learningPaths" (has_certificate false —
// prep material, not a credential on its own; real duration_in_minutes here,
// which certifications themselves don't carry since an exam has no runtime).

const MS_CATALOG = 'https://learn.microsoft.com/api/catalog/'

interface MsCertification {
  uid: string
  title: string
  subtitle?: string
  url: string
  icon_url?: string
  levels?: string[]
  roles?: string[]
}

interface MsLearningPath {
  uid: string
  title: string
  summary?: string
  url: string
  icon_url?: string
  levels?: string[]
  roles?: string[]
  products?: string[]
  duration_in_minutes?: number
}

function stripHtml(s: string | undefined | null): string | null {
  if (!s) return null
  const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text.slice(0, 2000) : null
}

function minutesToDuration(mins: number | undefined): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const hours = Math.round((mins / 60) * 10) / 10
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

export async function fetchMicrosoftLearn(runAt: string): Promise<CertificationRecord[]> {
  const out: CertificationRecord[] = []

  const certsRes = await getJson<{ certifications?: MsCertification[] }>(`${MS_CATALOG}?type=certifications&locale=en-us`, 20000)
  for (const c of certsRes?.certifications ?? []) {
    if (!c.uid || !c.title || !c.url) continue
    out.push({
      title: c.title,
      provider: 'Microsoft',
      provider_logo: toHttps(c.icon_url) || 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128',
      description: stripHtml(c.subtitle),
      url: c.url,
      canonical_url: canonicalizeUrl(c.url),
      // Microsoft certifications are earned by passing a paid proctored exam.
      is_free: false,
      price_label: 'Paid exam',
      level: c.levels?.[0] ? titleCase(c.levels[0]) : null,
      duration: null,
      topics: (c.roles ?? []).map(titleCase),
      has_certificate: true,
      source: 'microsoft_learn_cert',
      source_id: c.uid,
      last_seen_at: runAt,
    })
  }

  const pathsRes = await getJson<{ learningPaths?: MsLearningPath[] }>(`${MS_CATALOG}?type=learningPaths&locale=en-us`, 20000)
  for (const p of pathsRes?.learningPaths ?? []) {
    if (!p.uid || !p.title || !p.url) continue
    out.push({
      title: p.title,
      provider: 'Microsoft Learn',
      provider_logo: toHttps(p.icon_url) || 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128',
      description: stripHtml(p.summary),
      url: p.url,
      canonical_url: canonicalizeUrl(p.url),
      is_free: true,
      price_label: 'Free',
      level: p.levels?.[0] ? titleCase(p.levels[0]) : null,
      duration: minutesToDuration(p.duration_in_minutes),
      topics: (p.products ?? []).map(titleCase),
      // A learning path is free prep material, not the credential itself —
      // marking it has_certificate would overstate what completing it earns.
      has_certificate: false,
      source: 'microsoft_learn_path',
      source_id: p.uid,
      last_seen_at: runAt,
    })
  }

  return out
}

// ── Simplilearn ─────────────────────────────────────────────────────────────
// Course pages are a client-rendered SPA with no server-side hydration blob
// to read (no __NEXT_DATA__, no __INITIAL_STATE__ — verified 11 Aug 2026),
// so description/duration are usually not recoverable this way, but every
// page also carries a static schema.org Course JSON-LD block with the real
// title, provider, and price, which is what this reads. robots.txt
// explicitly allows /courses/*, /pg/* and course-topic paths.

const SIMPLILEARN_SITEMAP = 'https://www.simplilearn.com/sitemaps/www.sitemap_production.xml'
const SIMPLILEARN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'

/** Course/certification-shaped paths only — the sitemap also lists the
 *  homepage, blog and resource pages, which are not certifications. */
function looksLikeSimplilearnCourse(url: string): boolean {
  try {
    const u = new URL(url)
    const segments = u.pathname.split('/').filter(Boolean)
    if (segments.length === 0 || segments.length > 2) return false
    return /(training|certification|course|bootcamp|program|masters?-in-)/i.test(u.pathname)
  } catch {
    return false
  }
}

interface SchemaOffer {
  category?: string
  priceCurrency?: string
  // Observed as both a JSON number and a numeric-looking string ("17135.0000")
  // depending on the course — coerced with Number() wherever it's used.
  price?: number | string
  eligibleRegion?: { name?: string }
}

interface SchemaCourse {
  '@type'?: string
  name?: string
  description?: string
  provider?: { name?: string }
  hasCourseInstance?: { offers?: SchemaOffer[] }
}

async function fetchSimplilearnCoursePage(url: string, runAt: string): Promise<CertificationRecord | null> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': SIMPLILEARN_UA } }, { maxRetries: 1, timeoutMs: 12000 })
  if (!res.ok) return null
  const html = await res.text()
  const $ = cheerio.load(html)

  let course: SchemaCourse | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (course) return
    try {
      const parsed = JSON.parse($(el).contents().text())
      if (parsed?.['@type'] === 'Course') course = parsed as SchemaCourse
    } catch {
      // Not every ld+json block on the page is valid/relevant — skip it.
    }
  })
  if (!course) return null
  const c = course as SchemaCourse
  if (!c.name) return null

  // Prefer the USD offer (the app's primary audience is not India-only), and
  // treat a course with no paid offer at all as free rather than guessing.
  const offers = c.hasCourseInstance?.offers ?? []
  const usdOffer = offers.find((o) => o.priceCurrency === 'USD') ?? offers[0]
  const isFree = offers.length === 0 || offers.every((o) => (o.category ?? '').toLowerCase() === 'free')
  // Some offers carry price as a numeric-looking string ("17135.0000")
  // rather than a JSON number — coerce and drop trailing zeros either way.
  const numericPrice = usdOffer?.price != null ? Number(usdOffer.price) : null
  const priceLabel = isFree
    ? 'Free'
    : numericPrice != null && !Number.isNaN(numericPrice)
      ? `${usdOffer!.priceCurrency === 'USD' ? '$' : usdOffer!.priceCurrency + ' '}${numericPrice % 1 === 0 ? numericPrice : numericPrice.toFixed(2)}`
      : 'Paid'

  const segments = new URL(url).pathname.split('/').filter(Boolean)
  const topic = segments.length > 1 ? titleCase(segments[0]) : null

  return {
    title: c.name,
    provider: 'Simplilearn',
    provider_logo: 'https://www.google.com/s2/favicons?domain=simplilearn.com&sz=128',
    // The page's own description/subtitle is templated boilerplate on nearly
    // every listing (often just the title repeated) rather than real
    // per-course copy — an honest generic line beats presenting that as if
    // it were distinct content.
    description: `${c.name} — an industry-recognised ${isFree ? '' : 'certification '}course from Simplilearn${topic ? ` in ${topic}` : ''}.`,
    url,
    canonical_url: canonicalizeUrl(url),
    is_free: isFree,
    price_label: priceLabel,
    level: null,
    // Not recoverable from the static page for this source — left absent
    // rather than guessed, per the table's own "shown when present rather
    // than fabricated when absent" rule.
    duration: null,
    topics: topic ? [topic] : [],
    has_certificate: true,
    source: 'simplilearn',
    source_id: segments.join('/'),
    last_seen_at: runAt,
  }
}

/** Runs a bounded number of promises at once — plain fetch has no built-in
 *  concurrency limit, and hitting Simplilearn with hundreds of simultaneous
 *  requests would be both slow to complete inside Vercel's maxDuration and
 *  needlessly aggressive against a site whose robots.txt permits, but does
 *  not invite, this volume. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function fetchSimplilearn(runAt: string, maxCourses = 200): Promise<CertificationRecord[]> {
  const res = await fetchWithRetry(SIMPLILEARN_SITEMAP, { headers: { 'User-Agent': SIMPLILEARN_UA } }, { maxRetries: 2, timeoutMs: 20000 })
  if (!res.ok) return []
  const xml = await res.text()
  const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map((m) => m[1])
  const candidates = urls.filter(looksLikeSimplilearnCourse).slice(0, maxCourses)

  const results = await mapLimit(candidates, 8, (url) =>
    fetchSimplilearnCoursePage(url, runAt).catch(() => null)
  )
  return results.filter((r): r is CertificationRecord => r !== null)
}

/** Everything, deduplicated on canonical URL. */
export async function collectCertifications(maxCoursera = 3000, maxSimplilearn = 200): Promise<CertificationRecord[]> {
  const runAt = new Date().toISOString()
  const [coursera, msLearn, simplilearn] = await Promise.all([
    fetchCoursera(maxCoursera, runAt),
    fetchMicrosoftLearn(runAt),
    fetchSimplilearn(runAt, maxSimplilearn),
  ])
  const all = [...fetchFreeCodeCamp(runAt), ...coursera, ...msLearn, ...simplilearn]

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
