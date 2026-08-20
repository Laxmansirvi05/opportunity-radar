import { describe, it, expect } from 'vitest'
import { buildNoteSearchFilter } from '@/features/notes/lib/note-search-filter'

/**
 * PostgREST splits an `or=(...)` group on commas, so a search term carrying
 * one used to be parsed as two malformed conditions and the whole request
 * failed — typing a comma into the notes search box returned a 500 and no
 * results at all.
 *
 * The value is quoted rather than stripped, because note content is prose:
 * removing the comma from "plan, then execute" produces a phrase that no
 * longer matches the text on screen. Each expectation below was also checked
 * against the live API with a note containing the character in question.
 */

const BACKSLASH = String.fromCharCode(92)

/** The pattern inside the quotes, for tests that only care about escaping. */
function patternOf(filter: string | null): string {
  const match = filter?.match(/^title\.ilike\."(.*)",content\.ilike\."\1"$/)
  if (!match) throw new Error(`unexpected filter shape: ${filter}`)
  return match[1]
}

describe('buildNoteSearchFilter', () => {
  it('searches both title and content', () => {
    expect(buildNoteSearchFilter('kubernetes')).toBe(
      'title.ilike."%kubernetes%",content.ilike."%kubernetes%"'
    )
  })

  it('returns null when there is nothing to search for', () => {
    expect(buildNoteSearchFilter(null)).toBeNull()
    expect(buildNoteSearchFilter(undefined)).toBeNull()
    expect(buildNoteSearchFilter('')).toBeNull()
    expect(buildNoteSearchFilter('   ')).toBeNull()
  })

  it('keeps a comma in the term instead of breaking the expression', () => {
    const filter = buildNoteSearchFilter('plan, then execute')
    // The comma survives inside the quoted value...
    expect(patternOf(filter)).toBe('%plan, then execute%')
    // ...and the only unquoted separator is the one between the two conditions.
    expect(filter).toBe('title.ilike."%plan, then execute%",content.ilike."%plan, then execute%"')
  })

  it('escapes LIKE wildcards so they stay literal', () => {
    // Two backslashes, not one: LIKE-escaping adds `\`, then quote-escaping
    // doubles it so PostgREST hands Postgres back the single `\%` LIKE needs.
    expect(patternOf(buildNoteSearchFilter('50%'))).toBe(`%50${BACKSLASH.repeat(2)}%%`)
    expect(patternOf(buildNoteSearchFilter('snake_case'))).toBe(
      `%snake${BACKSLASH.repeat(2)}_case%`
    )
  })

  /**
   * Regression: `\` is a LIKE escape character too. Without escaping it,
   * searching `C:\path` had LIKE read `\p` as "literal p" and match `C:path`
   * instead — both a miss on the real text and a false hit on other notes.
   */
  it('escapes backslashes for both LIKE and the quoted value', () => {
    // One backslash -> doubled for LIKE -> each of those doubled for quoting.
    expect(patternOf(buildNoteSearchFilter(`C:${BACKSLASH}path`))).toBe(
      `%C:${BACKSLASH.repeat(4)}path%`
    )
  })

  it('escapes double quotes so they cannot close the quoted value', () => {
    expect(patternOf(buildNoteSearchFilter('say "hi"'))).toBe(
      `%say ${BACKSLASH}"hi${BACKSLASH}"%`
    )
  })

  it('leaves other structural characters intact — quoting already covers them', () => {
    expect(patternOf(buildNoteSearchFilter('f(x)'))).toBe('%f(x)%')
    expect(patternOf(buildNoteSearchFilter("it's"))).toBe("%it's%")
  })

  it('strips control characters rather than passing them to the filter', () => {
    expect(patternOf(buildNoteSearchFilter('plan\nthen'))).toBe('%plan then%')
    expect(buildNoteSearchFilter('\n\t')).toBeNull()
  })

  it('bounds the term length', () => {
    const filter = buildNoteSearchFilter('x'.repeat(500))
    expect(patternOf(filter)).toBe(`%${'x'.repeat(100)}%`)
  })

  it('keeps ordinary multi-word searches intact', () => {
    expect(patternOf(buildNoteSearchFilter('  interview prep  '))).toBe('%interview prep%')
  })
})
