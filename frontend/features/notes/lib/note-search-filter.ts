/**
 * Builds the PostgREST `or=(...)` expression behind notes search.
 *
 * The bug this exists for: the search term was interpolated raw into that
 * expression, and PostgREST splits an `or=(...)` group on commas. Searching
 * `plan, then execute` was parsed as two malformed conditions and the request
 * failed — a comma in the notes search box returned a 500 and no results at
 * all. (RLS and the `user_id` filter are applied separately and were never at
 * risk; this was correctness, not access.)
 *
 * Unlike the opportunities and certifications searches, which strip structural
 * characters with `sanitizeFilterTerm`, this quotes the value instead. Note
 * content is prose, where commas and quotes are ordinary — stripping them
 * silently turns "plan, then execute" into a phrase that no longer matches the
 * text the user is looking at. PostgREST double-quoted values carry those
 * characters intact.
 *
 * That means two escaping layers, applied in this order:
 *
 *   1. SQL LIKE — `%`, `_` and `\` are special to LIKE itself, so each is
 *      prefixed with a backslash to stay literal. Missing `\` here is a bug in
 *      its own right: searching `C:\path` had LIKE read `\p` as an escape and
 *      match on `C:path` instead.
 *   2. PostgREST quoting — inside a double-quoted value, `"` and `\` are
 *      escaped with a backslash, which PostgREST removes again before Postgres
 *      ever sees the pattern.
 *
 * Both use a single pass with a character class, so a backslash introduced by
 * one rule is never re-escaped by a later rule in the same layer.
 *
 * Returns null when there is nothing to search for, so the caller leaves the
 * query unfiltered rather than applying an empty `%%` match.
 */

/** Long enough for any real phrase; bounds what reaches the database. */
const MAX_TERM_LENGTH = 100

/** Control characters have no place in a search term or a filter expression. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g

export function buildNoteSearchFilter(rawQuery: string | null | undefined): string | null {
  if (!rawQuery) return null

  const term = rawQuery.replace(CONTROL_CHARS, ' ').trim().slice(0, MAX_TERM_LENGTH)
  if (!term) return null

  // Layer 1: keep LIKE's own metacharacters literal.
  const likePattern = term.replace(/[\\%_]/g, (char) => `\\${char}`)
  // Layer 2: make the whole thing safe to sit inside a quoted filter value.
  const quoted = `"%${likePattern.replace(/["\\]/g, (char) => `\\${char}`)}%"`

  return `title.ilike.${quoted},content.ilike.${quoted}`
}
