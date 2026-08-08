/**
 * Canonical form of an apply URL, used to collapse the same posting reached by
 * different links (tracking params, session ids, host variants) into one row.
 *
 * Deliberately conservative: it only strips things that are known not to change
 * which job is shown. Anything that might be an identifier is preserved, since
 * over-normalising would merge two genuinely different postings.
 */

/** Params that never identify a posting — purely analytics/attribution. */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gh_src', 'gclid', 'fbclid', 'msclkid', 'ref', 'referrer', 'source',
  'mc_cid', 'mc_eid', '_ga', 'igshid', 'trk', 'trackingid', 'originalsubdomain',
])

export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  // Scheme: https and http serve the same posting.
  url.protocol = 'https:'

  // Host: lowercase, drop a leading www., drop default ports.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.port = ''

  // Fragments never select a posting.
  url.hash = ''

  // Drop tracking params, keep everything else, and sort for stability so two
  // URLs differing only in param order canonicalise identically.
  const kept: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) kept.push([key, value])
  })
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  url.search = ''
  for (const [k, v] of kept) url.searchParams.append(k, v)

  // Trailing slash on a path carries no meaning for job boards.
  let path = url.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  url.pathname = path

  return url.toString()
}

/**
 * Fuzzy identity for a posting, used as a last-resort duplicate check when two
 * sources advertise the same job under different URLs.
 *
 * Intentionally coarse — it drops seniority markers and punctuation so
 * "Software Engineer Intern (Bangalore)" and "software engineer intern" collapse,
 * while still keeping company and role distinct enough to avoid false merges.
 */
export function fingerprintPosting(
  company: string | null | undefined,
  title: string | null | undefined,
  location?: string | null
): string {
  const norm = (s: string | null | undefined) =>
    (s ?? '')
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/\b(intern|internship|trainee|role|position|opening|job|at|inc|llc|ltd|pvt|private|limited|technologies|technology|labs|india)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '')
      .trim()

  const city = (location ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '')
    .slice(0, 12)

  return `${norm(company)}:${norm(title)}:${city}`
}
