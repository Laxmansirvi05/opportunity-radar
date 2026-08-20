/**
 * Readers for resume fields that arrive under more than one key.
 *
 * Resumes reach the scoring engines from several places — the builder, the PDF
 * parser, older stored rows — and the same value can be `bullets` or
 * `highlights`, `start_date` or `startDate`. Every consumer used to reach for
 * those alternatives through an `as any`, which also meant nothing checked the
 * values were the strings the callers immediately called `.trim()` on. A
 * single malformed entry from a bad parse would have thrown.
 *
 * These return only strings, so a malformed field degrades to "no evidence"
 * rather than crashing a scoring run.
 */

function read(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined
  return (source as Record<string, unknown>)[key]
}

/**
 * The first key that holds an array, as strings only.
 * `stringList(exp, 'bullets', 'highlights')`
 */
export function stringList(source: unknown, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = read(source, key)
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string')
    }
  }
  return []
}

/**
 * The first key that holds a non-empty string, or a number rendered as one
 * (`graduation_year` is stored numerically on some rows). Null when none match.
 */
export function firstString(source: unknown, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = read(source, key)
    if (typeof value === 'string' && value.length > 0) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}
