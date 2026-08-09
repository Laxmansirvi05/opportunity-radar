/**
 * Geography classification.
 *
 * Policy: the catalogue is India-first. An international listing is only
 * publishable when it is genuinely remote, because a student in India cannot
 * act on an on-site role in San Francisco.
 */

export type GeoDecision = {
  country: 'IN' | 'INTL' | 'UNKNOWN'
  isRemote: boolean
  /** False when the listing should not be published under the India-first policy. */
  publishable: boolean
  reason: string
}

const INDIA_CITIES = [
  'bangalore', 'bengaluru', 'hyderabad', 'pune', 'mumbai', 'bombay', 'delhi',
  'new delhi', 'ncr', 'noida', 'gurgaon', 'gurugram', 'chennai', 'madras',
  'kolkata', 'calcutta', 'ahmedabad', 'jaipur', 'indore', 'chandigarh',
  'coimbatore', 'kochi', 'cochin', 'trivandrum', 'thiruvananthapuram',
  'bhubaneswar', 'nagpur', 'surat', 'vadodara', 'lucknow', 'kanpur', 'bhopal',
  'visakhapatnam', 'vizag', 'mysore', 'mysuru', 'mangalore', 'goa', 'jodhpur',
]

const INDIA_STATES = [
  'karnataka', 'maharashtra', 'telangana', 'tamil nadu', 'kerala', 'gujarat',
  'rajasthan', 'punjab', 'haryana', 'uttar pradesh', 'madhya pradesh',
  'west bengal', 'andhra pradesh', 'odisha', 'bihar', 'assam', 'jharkhand',
]

const REMOTE_TERMS = [
  'remote', 'work from home', 'wfh', 'anywhere', 'distributed',
  'virtual', 'online', 'telecommute',
]

/** "Remote - US" style strings are remote but geographically restricted. */
const REMOTE_RESTRICTED = /\bremote\b[\s,\-–—]*\(?\s*(us|usa|united states|uk|emea|europe|canada|apac|latam|americas)\b/i

function haystack(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase()
}

/**
 * Sources whose audience is India. A bare "Remote" listing on an India-native
 * platform is an Indian remote role — Unstop and Internshala serve Indian
 * students, so their remote postings are not "international" in any sense a
 * student would recognise. Without this hint the classifier had no way to know,
 * and marked 1,041 India-native remote listings as international, which then
 * skewed the India-weighted publishing quota.
 */
const INDIA_NATIVE_SOURCES = new Set(['unstop', 'internshala', 'naukri', 'hirist', 'cutshort'])

export function isIndiaNativeSource(source: string | null | undefined): boolean {
  return INDIA_NATIVE_SOURCES.has((source ?? '').toLowerCase())
}

export function classifyGeo(
  location: string | null | undefined,
  extra?: { title?: string | null; description?: string | null; mode?: string | null; source?: string | null }
): GeoDecision {
  const locText = (location ?? '').toLowerCase()
  const all = haystack(location, extra?.mode, extra?.title)

  const isRemote =
    REMOTE_TERMS.some((t) => all.includes(t)) ||
    (extra?.mode ?? '').toLowerCase() === 'remote'

  const isIndia =
    /\bindia\b|\bbharat\b|\bind\b/.test(locText) ||
    INDIA_CITIES.some((c) => new RegExp(`\\b${c}\\b`).test(locText)) ||
    INDIA_STATES.some((s) => locText.includes(s))

  if (isIndia) {
    return { country: 'IN', isRemote, publishable: true, reason: 'India location' }
  }

  // A remote listing from an India-native platform is an Indian remote role.
  if (isRemote && isIndiaNativeSource(extra?.source) && !REMOTE_RESTRICTED.test(locText)) {
    return { country: 'IN', isRemote: true, publishable: true, reason: 'remote listing on an India-native source' }
  }

  // No location at all: keep only if it is explicitly remote, otherwise we
  // cannot tell whether an Indian student could take it.
  if (!locText.trim()) {
    return isRemote
      ? { country: 'UNKNOWN', isRemote: true, publishable: true, reason: 'no location but explicitly remote' }
      : { country: 'UNKNOWN', isRemote: false, publishable: false, reason: 'no location and not remote' }
  }

  // "Remote - US" is remote to Americans, not to a student in India.
  if (REMOTE_RESTRICTED.test(locText)) {
    return {
      country: 'INTL',
      isRemote: true,
      publishable: false,
      reason: 'remote but restricted to a non-India region',
    }
  }

  if (isRemote) {
    return { country: 'INTL', isRemote: true, publishable: true, reason: 'international but genuinely remote' }
  }

  return { country: 'INTL', isRemote: false, publishable: false, reason: 'international and on-site' }
}

/**
 * Enforce the India-weighted mix on a publishable set.
 *
 * Applied as a quota rather than a hard filter: international-remote listings
 * are good for students, they just must not crowd out India results. Anything
 * above the cap is trimmed (lowest trust tier first) instead of rejected at
 * ingest, so the ordering of a run cannot change what qualifies.
 */
export function applyGeoQuota<T extends { country: string; trust_tier?: number }>(
  items: T[],
  maxInternationalShare = 0.15
): { kept: T[]; trimmed: T[] } {
  const india = items.filter((i) => i.country === 'IN')
  const intl = items.filter((i) => i.country !== 'IN')

  // Cap international at a share of the *total* we would publish.
  const cap = Math.floor((india.length * maxInternationalShare) / (1 - maxInternationalShare))
  if (intl.length <= cap) return { kept: items, trimmed: [] }

  const ranked = [...intl].sort((a, b) => (a.trust_tier ?? 3) - (b.trust_tier ?? 3))
  return { kept: [...india, ...ranked.slice(0, cap)], trimmed: ranked.slice(cap) }
}
