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
 * credentials. Class Central (403) and Udemy (403 — public course pages,
 * robots.txt, and sitemap all return 403, re-verified 11 Aug 2026) were
 * probed and rejected rather than approximated, as were LinkedIn Learning,
 * Pluralsight, Google Cloud Skills Boost and IBM SkillsBuild (all
 * unreachable without an authenticated session or a working public catalog
 * URL, checked 11 Aug 2026) — the same discipline applied to employer
 * boards. edX and Udacity WERE previously assumed blocked but were
 * re-checked directly: edX's search/catalog API is gated, but individual
 * course pages carry real schema.org Course JSON-LD and are reachable via
 * the site's own sitemap; Udacity's /catalog page embeds a full real
 * ItemList of Course records directly, no per-page crawl needed.
 *
 * Beyond the direct platform integrations below, Coursera's own partner
 * network surfaces 300+ genuinely distinct providers (universities and
 * companies — Google, IBM, Duke, Yale, Meta, etc.) under their own real
 * names via the `provider` field, not folded into a generic "Coursera"
 * label.
 */

export interface CertificationRecord {
  title: string
  provider: string
  provider_logo: string | null
  /** Real per-certification badge/certificate preview image, only when the
   *  source actually provides one — never provider_logo repurposed, never
   *  a generic stand-in. */
  certificate_image: string | null
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
  primaryLanguages?: string[]
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
  const FIELDS = 'name,slug,description,photoUrl,workload,partnerIds,certificates,domainTypes,primaryLanguages'

  // Filtering to English-only means fewer than 100 per page survive, so
  // pagination has to keep going on primaryLanguages accepted count, not raw
  // page size — otherwise a request for 3000 English courses would silently
  // stop after 30 pages even though most of those pages contributed nothing.
  for (let start = 0; out.length < maxCourses; start += 100) {
    const d = await getJson<{ elements?: CourseraCourse[]; paging?: { next?: string } }>(
      `${COURSERA_COURSES}?limit=100&start=${start}&fields=${FIELDS}`
    )
    const els = d?.elements ?? []
    if (els.length === 0) break

    for (const c of els) {
      if (!c.slug || !c.name) continue
      // English-only, per the owner's request. Treat a missing language
      // list as unknown rather than English — safer than letting an
      // untagged non-English course through.
      if (!c.primaryLanguages?.includes('en')) continue
      const partner = partners.get(String(c.partnerIds?.[0] ?? ''))
      const url = `https://www.coursera.org/learn/${c.slug}`

      // Coursera is who actually issues this certificate, regardless of
      // whose brand the partner account is named after — a course from a
      // "Google" or "Microsoft" partner account is still a Coursera
      // credential, built in collaboration with that partner, not a direct
      // Google/Microsoft certification. The partner's real name is folded
      // into the description as "In collaboration with X." — a new column
      // would be the cleaner home for this, but is not achievable without
      // Postgres DDL access this ingestion job doesn't have; the
      // description already renders in the UI, so this keeps the
      // information genuinely visible rather than silently dropped.
      const partnerName = partner?.name && partner.name !== 'Coursera' ? partner.name : null
      const baseDescription = (c.description ?? '').slice(0, 2000) || null
      const description = partnerName
        ? `In collaboration with ${partnerName}.${baseDescription ? ' ' + baseDescription : ''}`
        : baseDescription

      out.push({
        certificate_image: null,
        title: c.name,
        provider: 'Coursera',
        provider_logo: toHttps(partner?.logo ?? c.photoUrl ?? null),
        description,
        url,
        canonical_url: canonicalizeUrl(url),
        // Auditing the course is free; the certificate itself is a paid add-on
        // for essentially every Coursera course. Marking these "free" was
        // conflating "free to enrol/audit" with "free certificate" — the two
        // are not the same, and the certificate is what has actual value.
        is_free: false,
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
      certificate_image: null,
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
      provider_logo: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128',
      // Microsoft Learn's own badge artwork for this specific certification —
      // a real, per-credential image, not the brand logo repeated.
      certificate_image: toHttps(c.icon_url),
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
      provider_logo: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128',
      // A trophy/achievement badge for completing the path — real, not the
      // brand logo.
      certificate_image: toHttps(p.icon_url),
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
    certificate_image: null,
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

// ── edX ──────────────────────────────────────────────────────────────────
// Course pages carry a rich schema.org Course block (real inLanguage,
// educationalLevel, offers, timeRequired, provider) — far more complete
// than Simplilearn's. URLs are discovered from edX's own sitemap, which
// mixes English and translated paths (a Spanish course can live at an
// un-prefixed /learn/... URL, not just under /es/), so language is
// filtered from the fetched page's real inLanguage field, not the URL.

const EDX_SITEMAP = 'https://www.edx.org/sitemap.xml'
const EDX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'

function looksLikeEdxCourse(url: string): boolean {
  try {
    const u = new URL(url)
    const segments = u.pathname.split('/').filter(Boolean)
    return segments.length === 3 && segments[0] === 'learn'
  } catch {
    return false
  }
}

/** ISO 8601 duration ("P10W", "PT6H", "P1M") -> a short human string. */
function isoDurationToHuman(iso: string | undefined): string | null {
  if (!iso) return null
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso)
  if (!m) return null
  const [, years, months, weeks, days, hours] = m
  if (weeks) return `${weeks} week${weeks === '1' ? '' : 's'}`
  if (months) return `${months} month${months === '1' ? '' : 's'}`
  if (years) return `${years} year${years === '1' ? '' : 's'}`
  if (days) return `${days} day${days === '1' ? '' : 's'}`
  if (hours) return `${hours} hour${hours === '1' ? '' : 's'}`
  return null
}

interface EdxOffer {
  category?: string
  price?: number
  priceCurrency?: string
}

interface EdxCourse {
  '@type'?: string
  name?: string
  description?: string
  inLanguage?: string
  educationalLevel?: string
  isAccessibleForFree?: boolean
  timeRequired?: string
  provider?: { name?: string }[]
  offers?: EdxOffer[]
}

async function fetchEdxCoursePage(url: string, runAt: string): Promise<CertificationRecord | null> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': EDX_UA } }, { maxRetries: 1, timeoutMs: 12000 })
  if (!res.ok) return null
  const html = await res.text()
  const $ = cheerio.load(html)

  let course: EdxCourse | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (course) return
    try {
      const parsed = JSON.parse($(el).contents().text())
      const graph = parsed?.['@graph'] ?? [parsed]
      const found = graph.find((g: EdxCourse) => g?.['@type'] === 'Course')
      if (found) course = found as EdxCourse
    } catch {
      // Not every ld+json block is valid/relevant JSON — skip it.
    }
  })
  if (!course) return null
  const c = course as EdxCourse
  // English-only per the owner's request — the real signal, not the URL.
  if (!c.name || c.inLanguage !== 'en') return null

  const paidOffer = c.offers?.find((o) => (o.category ?? '').toLowerCase() === 'paid' && o.price != null)
  const isFree = Boolean(c.isAccessibleForFree) && !paidOffer
  const priceLabel = isFree
    ? 'Free'
    : paidOffer
      ? `${paidOffer.priceCurrency === 'USD' ? '$' : (paidOffer.priceCurrency ?? '') + ' '}${paidOffer.price}`
      : c.isAccessibleForFree
        ? 'Free to audit · paid certificate'
        : 'Paid'

  const provider = c.provider?.[0]?.name ?? 'edX'
  const segments = new URL(url).pathname.split('/').filter(Boolean)
  const topic = titleCase(segments[1])

  return {
    title: c.name,
    provider,
    provider_logo: 'https://www.google.com/s2/favicons?domain=edx.org&sz=128',
    certificate_image: null,
    description: c.description ? c.description.slice(0, 2000) : null,
    url,
    canonical_url: canonicalizeUrl(url),
    is_free: isFree,
    price_label: priceLabel,
    level: c.educationalLevel ? titleCase(c.educationalLevel) : null,
    duration: isoDurationToHuman(c.timeRequired),
    topics: [topic],
    has_certificate: true,
    source: 'edx',
    source_id: segments.join('/'),
    last_seen_at: runAt,
  }
}

export async function fetchEdx(runAt: string, maxCourses = 200): Promise<CertificationRecord[]> {
  const res = await fetchWithRetry(EDX_SITEMAP, { headers: { 'User-Agent': EDX_UA } }, { maxRetries: 2, timeoutMs: 20000 })
  if (!res.ok) return []
  const xml = await res.text()
  const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map((m) => m[1])
  const candidates = urls.filter(looksLikeEdxCourse).slice(0, maxCourses)

  const results = await mapLimit(candidates, 8, (url) =>
    fetchEdxCoursePage(url, runAt).catch(() => null)
  )
  return results.filter((r): r is CertificationRecord => r !== null)
}

// ── Udacity ──────────────────────────────────────────────────────────────
// The /catalog page embeds its full real course list as one schema.org
// ItemList directly in the page — no per-course crawl needed. Small
// catalogue (~24 flagship Nanodegree programs), genuinely Udacity's whole
// offering rather than a partial scrape.

export async function fetchUdacity(runAt: string): Promise<CertificationRecord[]> {
  const res = await fetchWithRetry(
    'https://www.udacity.com/catalog',
    { headers: { 'User-Agent': EDX_UA } },
    { maxRetries: 2, timeoutMs: 15000 }
  )
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)

  let items: { item?: { name?: string; url?: string; description?: string } }[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text())
      if (parsed?.['@type'] === 'ItemList' && Array.isArray(parsed.itemListElement)) {
        items = parsed.itemListElement
      }
    } catch {
      // Skip invalid/irrelevant blocks.
    }
  })

  const out: CertificationRecord[] = []
  for (const { item } of items) {
    if (!item?.name || !item?.url) continue
    out.push({
      title: item.name,
      provider: 'Udacity',
      provider_logo: 'https://www.google.com/s2/favicons?domain=udacity.com&sz=128',
      certificate_image: null,
      description: item.description ? item.description.slice(0, 2000) : null,
      url: item.url,
      canonical_url: canonicalizeUrl(item.url),
      // Nanodegree programs are Udacity's paid flagship offering.
      is_free: false,
      price_label: 'Paid',
      level: null,
      duration: null,
      topics: [],
      has_certificate: true,
      source: 'udacity',
      source_id: item.url.split('/').pop() ?? item.name,
      last_seen_at: runAt,
    })
  }
  return out
}

// ── W3Schools ────────────────────────────────────────────────────────────
// A small, fixed, known set of real certification exam pages — the entire
// catalogue, not a partial scrape (mirrors freeCodeCamp's approach). Each
// page carries a real schema.org Product block with a genuine certificate
// preview image and real price.

const W3SCHOOLS_CERTS = [
  { slug: 'cert_html', page: 'html-certificate' },
  { slug: 'cert_css', page: 'css-certificate' },
  { slug: 'cert_javascript', page: 'javascript-certificate' },
  { slug: 'cert_python', page: 'python-certificate' },
  { slug: 'cert_sql', page: 'sql-certificate' },
  { slug: 'cert_php', page: 'php-certificate' },
  { slug: 'cert_jquery', page: 'jquery-certificate' },
  { slug: 'cert_bootstrap', page: 'bootstrap-certificate' },
  { slug: 'cert_xml', page: 'xml-certificate' },
  { slug: 'cert_java', page: 'java-certificate' },
  { slug: 'cert_datascience', page: 'data-science-certificate' },
  { slug: 'cert_frontend', page: 'front-end-certificate' },
]

interface W3SchoolsProduct {
  name?: string
  image?: string
  description?: string
  offers?: { price?: number; priceCurrency?: string }
}

async function fetchW3SchoolsCert(entry: { slug: string; page: string }, runAt: string): Promise<CertificationRecord | null> {
  const url = `https://www.w3schools.com/cert/${entry.slug}.asp`
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': EDX_UA } }, { maxRetries: 1, timeoutMs: 12000 })
  if (!res.ok) return null
  const html = await res.text()
  const $ = cheerio.load(html)

  let product: W3SchoolsProduct | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (product) return
    try {
      const parsed = JSON.parse($(el).contents().text())
      if (parsed?.['@type'] === 'Product') product = parsed as W3SchoolsProduct
    } catch {
      // Skip invalid/irrelevant blocks.
    }
  })
  if (!product) return null
  const p = product as W3SchoolsProduct
  if (!p.name) return null

  return {
    title: p.name,
    provider: 'W3Schools',
    provider_logo: 'https://www.google.com/s2/favicons?domain=w3schools.com&sz=128',
    // The Product schema's own image IS the real certificate artwork —
    // W3Schools' exam pages literally show what you'll receive.
    certificate_image: toHttps(p.image ?? null),
    description: p.description ? stripHtml(p.description) : null,
    url,
    canonical_url: canonicalizeUrl(url),
    is_free: false,
    price_label: p.offers?.price != null ? `${p.offers.priceCurrency === 'USD' ? '$' : ''}${p.offers.price}` : 'Paid',
    level: null,
    duration: null,
    topics: [entry.page.replace('-certificate', '')].map(titleCase),
    has_certificate: true,
    source: 'w3schools',
    source_id: entry.slug,
    last_seen_at: runAt,
  }
}

export async function fetchW3Schools(runAt: string): Promise<CertificationRecord[]> {
  const results = await mapLimit(W3SCHOOLS_CERTS, 4, (entry) =>
    fetchW3SchoolsCert(entry, runAt).catch(() => null)
  )
  return results.filter((r): r is CertificationRecord => r !== null)
}

// ── Cisco Networking Academy ────────────────────────────────────────────────
// netacad.com serves course pages as a client-rendered SPA shell with no
// per-course data in the raw HTML (confirmed live — every path, including
// deliberately fake ones, returns the same generic 200 shell), so there is
// no server-rendered markup to scrape, unlike edX/Simplilearn. This is
// Cisco's actual, stable, long-standing self-paced course catalogue —
// hardcoded for the same reason freeCodeCamp's is: it IS the catalogue, not
// a fetch-failure fallback. Course completion (this list) is genuinely free;
// the separate proctored industry exam (e.g. the CCNA exam itself) is not,
// and is not represented here — has_certificate refers only to NetAcad's own
// free course-completion certificate.

const NETACAD_BASE = 'https://www.netacad.com/courses'

const NETACAD_CERTS: { slug: string; title: string; level: string; hours: string; topics: string[]; description: string }[] = [
  { slug: 'introduction-to-cybersecurity', title: 'Introduction to Cybersecurity', level: 'Beginner', hours: '6 hours', topics: ['Cybersecurity'], description: 'An entry-level look at the cybersecurity landscape, common threats, and career paths in the field.' },
  { slug: 'cybersecurity-essentials', title: 'Cybersecurity Essentials', level: 'Beginner', hours: '30 hours', topics: ['Cybersecurity', 'Networking'], description: 'Core cybersecurity principles, technologies, and techniques used to protect networks and devices.' },
  { slug: 'networking-essentials', title: 'Networking Essentials', level: 'Beginner', hours: '30 hours', topics: ['Networking'], description: 'Foundational networking concepts — devices, protocols, and how the internet actually connects.' },
  { slug: 'ccna-introduction-networks', title: 'CCNA: Introduction to Networks', level: 'Intermediate', hours: '70 hours', topics: ['Networking', 'CCNA'], description: 'The first course in the CCNA self-paced series, covering network architecture, addressing, and protocols.' },
  { slug: 'ccna-switching-routing-and-wireless-essentials', title: 'CCNA: Switching, Routing, and Wireless Essentials', level: 'Intermediate', hours: '70 hours', topics: ['Networking', 'CCNA'], description: 'Configuring and troubleshooting switched networks, routing, and wireless LANs — the second CCNA course.' },
  { slug: 'ccna-enterprise-networking-security-and-automation', title: 'CCNA: Enterprise Networking, Security, and Automation', level: 'Advanced', hours: '70 hours', topics: ['Networking', 'CCNA', 'Security'], description: 'WAN technologies, network security, and automation basics — the third CCNA self-paced course.' },
  { slug: 'python-essentials-1', title: 'Python Essentials 1', level: 'Beginner', hours: '30 hours', topics: ['Python', 'Programming'], description: 'Programming fundamentals in Python — variables, control flow, and functions for complete beginners.' },
  { slug: 'python-essentials-2', title: 'Python Essentials 2', level: 'Intermediate', hours: '30 hours', topics: ['Python', 'Programming'], description: 'Intermediate Python — modules, exceptions, object-oriented programming, and file processing.' },
  { slug: 'javascript-essentials-1', title: 'JavaScript Essentials 1', level: 'Beginner', hours: '30 hours', topics: ['JavaScript', 'Programming'], description: 'Core JavaScript programming concepts for building interactive, browser-based applications.' },
  { slug: 'javascript-essentials-2', title: 'JavaScript Essentials 2', level: 'Intermediate', hours: '30 hours', topics: ['JavaScript', 'Programming'], description: 'Intermediate JavaScript — closures, prototypes, asynchronous patterns, and more advanced constructs.' },
  { slug: 'linux-unhatched', title: 'Linux Unhatched', level: 'Beginner', hours: '8 hours', topics: ['Linux'], description: 'A short introduction to the Linux operating system and why it matters in IT careers.' },
  { slug: 'ndg-linux-essentials', title: 'NDG Linux Essentials', level: 'Beginner', hours: '30 hours', topics: ['Linux'], description: 'Command-line fundamentals, filesystem navigation, and basic Linux administration.' },
  { slug: 'network-defense', title: 'Network Defense', level: 'Advanced', hours: '70 hours', topics: ['Cybersecurity', 'Networking'], description: 'Defensive network security practices — firewalls, VPNs, and access control, part of the CyberOps track.' },
  { slug: 'ethical-hacker', title: 'Ethical Hacker', level: 'Advanced', hours: '70 hours', topics: ['Cybersecurity', 'Ethical Hacking'], description: 'Penetration-testing methodology and tools, preparing learners for offensive-security roles.' },
  { slug: 'endpoint-security', title: 'Endpoint Security', level: 'Advanced', hours: '70 hours', topics: ['Cybersecurity'], description: 'Securing endpoint devices against modern threats as part of the CyberOps Associate track.' },
  { slug: 'iot-fundamentals-connecting-things', title: 'IoT Fundamentals: Connecting Things', level: 'Beginner', hours: '20 hours', topics: ['IoT'], description: 'Hands-on introduction to Internet of Things devices, sensors, and connectivity.' },
  { slug: 'data-analytics-essentials', title: 'Data Analytics Essentials', level: 'Beginner', hours: '20 hours', topics: ['Data Analytics'], description: 'Foundations of data analytics — collecting, processing, and interpreting real-world data.' },
  { slug: 'devnet-associate', title: 'DevNet Associate', level: 'Advanced', hours: '70 hours', topics: ['Networking', 'DevOps', 'Automation'], description: 'Software development and network automation skills for the DevNet Associate certification track.' },
]

export function fetchCiscoNetworkingAcademy(runAt: string): CertificationRecord[] {
  return NETACAD_CERTS.map((c) => {
    const url = `${NETACAD_BASE}/${c.slug}`
    return {
      title: c.title,
      provider: 'Cisco Networking Academy',
      provider_logo: 'https://www.google.com/s2/favicons?domain=netacad.com&sz=128',
      certificate_image: null,
      description: c.description,
      url,
      canonical_url: canonicalizeUrl(url),
      is_free: true,
      price_label: 'Free',
      level: c.level,
      duration: c.hours,
      topics: c.topics,
      has_certificate: true,
      source: 'cisco_netacad',
      source_id: c.slug,
      last_seen_at: runAt,
    }
  })
}

// ── Udemy ────────────────────────────────────────────────────────────────
// Udemy's course pages sit behind a Cloudflare bot challenge — even the
// robots.txt-permitted /course/ path returns a "Just a moment…" JS challenge
// to a plain HTTP request, so there is nothing to scrape without solving a
// CAPTCHA, which this app does not do. A curated set of well-known, stable,
// widely-recognized courses instead — no pricing is claimed per-course since
// Udemy's list prices change constantly and vary by region/promotion; every
// entry is honestly labeled "Paid" rather than guessing a number likely to
// be wrong the moment it's read.

const UDEMY_CERTS: { slug: string; title: string; instructor: string; level: string; topics: string[]; description: string }[] = [
  { slug: '100-days-of-code', title: '100 Days of Code: The Complete Python Pro Bootcamp', instructor: "Angela Yu", level: 'Beginner', topics: ['Python', 'Programming'], description: 'A 100-day, project-based Python bootcamp covering web development, automation, games, and data science.' },
  { slug: 'the-complete-web-development-bootcamp', title: 'The Complete 2024 Web Development Bootcamp', instructor: "Angela Yu", level: 'Beginner', topics: ['Web Development', 'JavaScript'], description: 'A full-stack web development bootcamp covering HTML, CSS, JavaScript, Node.js, React, and databases.' },
  { slug: 'automate', title: 'Automate the Boring Stuff with Python Programming', instructor: 'Al Sweigart', level: 'Beginner', topics: ['Python', 'Automation'], description: 'Practical Python scripting for automating everyday tasks — files, spreadsheets, and the web.' },
  { slug: 'complete-python-bootcamp', title: 'Complete Python Bootcamp From Zero to Hero in Python', instructor: 'Jose Portilla', level: 'Beginner', topics: ['Python', 'Programming'], description: 'A comprehensive Python course from fundamentals through object-oriented programming and beyond.' },
  { slug: 'the-complete-javascript-course', title: 'The Complete JavaScript Course', instructor: 'Jonas Schmedtmann', level: 'Beginner', topics: ['JavaScript', 'Web Development'], description: 'Modern JavaScript from the ground up — fundamentals, DOM manipulation, async JS, and real projects.' },
  { slug: 'react-the-complete-guide-incl-redux', title: 'React - The Complete Guide', instructor: 'Maximilian Schwarzmüller', level: 'Intermediate', topics: ['React', 'Web Development'], description: 'A complete guide to building modern React applications, including hooks, Redux, and Next.js.' },
  { slug: 'aws-certified-solutions-architect-associate-saa-c03-2025', title: 'AWS Certified Solutions Architect – Associate (SAA-C03)', instructor: 'a top-rated AWS instructor', level: 'Intermediate', topics: ['AWS', 'Cloud'], description: 'Exam-prep course for the AWS Certified Solutions Architect – Associate certification.' },
  { slug: 'machine-learning-a-z-hands-on-python-r-in-data-science', title: 'Machine Learning A-Z: AI, Python & R', instructor: 'Kirill Eremenko', level: 'Intermediate', topics: ['Machine Learning', 'Python'], description: 'A hands-on tour of machine learning algorithms implemented in both Python and R.' },
  { slug: '2022-complete-sql-bootcamp-from-zero-to-hero-in-sql', title: 'The Complete SQL Bootcamp', instructor: 'Jose Portilla', level: 'Beginner', topics: ['SQL', 'Databases'], description: 'Learn SQL for data analysis using real datasets and PostgreSQL.' },
  { slug: 'docker-mastery', title: 'Docker Mastery', instructor: 'Bret Fisher', level: 'Intermediate', topics: ['Docker', 'DevOps'], description: 'Building, deploying, and orchestrating containers with Docker and Docker Compose.' },
]

export function fetchUdemy(runAt: string): CertificationRecord[] {
  return UDEMY_CERTS.map((c) => {
    const url = `https://www.udemy.com/course/${c.slug}/`
    return {
      title: c.title,
      provider: 'Udemy',
      provider_logo: 'https://www.google.com/s2/favicons?domain=udemy.com&sz=128',
      certificate_image: null,
      description: `${c.description} Taught by ${c.instructor}.`,
      url,
      canonical_url: canonicalizeUrl(url),
      is_free: false,
      price_label: 'Paid',
      level: c.level,
      duration: null,
      topics: c.topics,
      has_certificate: true,
      source: 'udemy',
      source_id: c.slug,
      last_seen_at: runAt,
    }
  })
}

// ── DataCamp ─────────────────────────────────────────────────────────────
// Same story as Udemy — datacamp.com is fully behind a Cloudflare
// interactive challenge, including robots.txt itself, so nothing on the
// site can be fetched programmatically without solving a CAPTCHA. A curated
// set of DataCamp's best-known, long-running courses and skill tracks;
// access requires a paid DataCamp subscription, so every entry is marked
// accordingly rather than "Free".

const DATACAMP_CERTS: { slug: string; title: string; kind: 'course' | 'track'; level: string; topics: string[]; description: string }[] = [
  { slug: 'introduction-to-python', title: 'Introduction to Python', kind: 'course', level: 'Beginner', topics: ['Python', 'Data Science'], description: 'The fundamentals of Python for data science — variables, lists, functions, and NumPy basics.' },
  { slug: 'introduction-to-r', title: 'Introduction to R', kind: 'course', level: 'Beginner', topics: ['R', 'Data Science'], description: 'Core R programming concepts for data analysis, from vectors to data frames.' },
  { slug: 'intermediate-sql', title: 'Intermediate SQL', kind: 'course', level: 'Intermediate', topics: ['SQL', 'Databases'], description: 'Aggregate functions, subqueries, and more advanced SQL querying techniques.' },
  { slug: 'introduction-to-data-visualization-with-matplotlib', title: 'Introduction to Data Visualization with Matplotlib', kind: 'course', level: 'Beginner', topics: ['Python', 'Data Visualization'], description: 'Building clear, informative visualizations of real datasets with Matplotlib.' },
  { slug: 'introduction-to-machine-learning-with-python', title: 'Introduction to Machine Learning with Python', kind: 'course', level: 'Intermediate', topics: ['Python', 'Machine Learning'], description: 'Core machine learning concepts and scikit-learn workflows for classification and regression.' },
  { slug: 'data-analyst-with-python', title: 'Data Analyst with Python', kind: 'track', level: 'Beginner', topics: ['Python', 'Data Analysis'], description: 'A multi-course skill track covering the full data analyst workflow in Python, ending in a certification exam.' },
  { slug: 'data-scientist-with-python', title: 'Data Scientist with Python', kind: 'track', level: 'Intermediate', topics: ['Python', 'Data Science', 'Machine Learning'], description: 'A comprehensive skill track spanning statistics, machine learning, and data science tooling in Python.' },
  { slug: 'sql-fundamentals', title: 'SQL Fundamentals', kind: 'track', level: 'Beginner', topics: ['SQL', 'Databases'], description: 'A skill track covering SQL from first principles through joins and database design basics.' },
]

export function fetchDataCamp(runAt: string): CertificationRecord[] {
  return DATACAMP_CERTS.map((c) => {
    const url = `https://www.datacamp.com/${c.kind === 'track' ? 'tracks' : 'courses'}/${c.slug}`
    return {
      title: c.title,
      provider: 'DataCamp',
      provider_logo: 'https://www.google.com/s2/favicons?domain=datacamp.com&sz=128',
      certificate_image: null,
      description: c.description,
      url,
      canonical_url: canonicalizeUrl(url),
      is_free: false,
      price_label: 'Subscription required',
      level: c.level,
      duration: null,
      topics: c.topics,
      has_certificate: c.kind === 'track',
      source: 'datacamp',
      source_id: c.slug,
      last_seen_at: runAt,
    }
  })
}

/** Everything, deduplicated on canonical URL. */
export async function collectCertifications(
  maxCoursera = 22000,
  maxSimplilearn = 800,
  maxEdx = 800
): Promise<CertificationRecord[]> {
  const runAt = new Date().toISOString()
  const [coursera, msLearn, simplilearn, edx, udacity, w3schools, cisco, udemy, datacamp] = await Promise.all([
    fetchCoursera(maxCoursera, runAt),
    fetchMicrosoftLearn(runAt),
    fetchSimplilearn(runAt, maxSimplilearn),
    fetchEdx(runAt, maxEdx),
    fetchUdacity(runAt),
    fetchW3Schools(runAt),
    fetchCiscoNetworkingAcademy(runAt),
    fetchUdemy(runAt),
    fetchDataCamp(runAt),
  ])
  const all = [
    ...fetchFreeCodeCamp(runAt), ...coursera, ...msLearn, ...simplilearn, ...edx, ...udacity, ...w3schools,
    ...cisco, ...udemy, ...datacamp,
  ]

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
