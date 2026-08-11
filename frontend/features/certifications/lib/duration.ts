export const DURATION_BUCKETS = [
  { key: 'short', label: 'Under 5 hours' },
  { key: 'medium', label: '5–20 hours' },
  { key: 'long', label: '20–100 hours' },
  { key: 'extended', label: '100+ hours' },
] as const
export type DurationBucketKey = (typeof DURATION_BUCKETS)[number]['key']

/**
 * Best-effort hour estimate from the source's own free-text duration string
 * ("300 hours", "1 hour 30 minutes", "6 weeks", "P10W" already converted to
 * "10 weeks" upstream) — used only to sort a record into a filter bucket.
 * The original text is what's ever shown to the student; this number is
 * never displayed. Weeks/months are converted with a stated ~5hrs/week
 * assumption (a common self-paced MOOC norm), which is why it's a bucket
 * range rather than a precise figure.
 *
 * There is no stored duration_hours column, so this bucket can only be
 * applied client-side after a page of rows comes back — see
 * hooks/use-certification-results.ts for how that's kept correct despite not
 * being expressible as a Postgres filter.
 */
export function estimateHours(duration: string | null): number | null {
  if (!duration) return null
  const d = duration.toLowerCase()
  // The `\+?` handles freeCodeCamp's own "1000+ hours" (its Full Stack
  // Developer cert's real, literal duration string) — without it, the "+"
  // between the number and "hours" broke the match entirely and the row
  // never matched any bucket.
  const hourMatch = /(\d+(?:\.\d+)?)\+?\s*hours?/.exec(d)
  const minMatch = /(\d+)\s*min/.exec(d)
  const weekMatch = /(\d+)\s*weeks?/.exec(d)
  const monthMatch = /(\d+)\s*months?/.exec(d)
  const yearMatch = /(\d+)\s*years?/.exec(d)
  const dayMatch = /(\d+)\s*days?/.exec(d)

  // Longest unit present wins — a string carrying both a coarse and a fine
  // unit ("2 years, 10 hours") describes the coarse one as the real
  // duration, not the other way round. Missing this meant edX's ISO-8601
  // durations rendered as "1 year"/"2 years" (see isoDurationToHuman in
  // ingest.ts) never matched hourMatch, monthMatch, weekMatch, or dayMatch
  // and so silently fell through to null — those rows never matched any
  // duration bucket at all, regardless of which one a student picked.
  if (yearMatch) return parseInt(yearMatch[1], 10) * 52 * 5
  if (monthMatch) return parseInt(monthMatch[1], 10) * 4.3 * 5
  if (weekMatch) return parseInt(weekMatch[1], 10) * 5
  if (hourMatch) {
    let hours = parseFloat(hourMatch[1])
    if (minMatch) hours += parseInt(minMatch[1], 10) / 60
    return hours
  }
  if (dayMatch) return parseInt(dayMatch[1], 10) * 2
  if (minMatch) return parseInt(minMatch[1], 10) / 60
  return null
}

export function durationBucket(duration: string | null): DurationBucketKey | null {
  const hours = estimateHours(duration)
  if (hours == null) return null
  if (hours < 5) return 'short'
  if (hours < 20) return 'medium'
  if (hours < 100) return 'long'
  return 'extended'
}
