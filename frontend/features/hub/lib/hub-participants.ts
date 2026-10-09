import type { SupabaseClient } from '@supabase/supabase-js'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** How many ids one request may ask about. */
export const MAX_SENDER_IDS = 100

/**
 * Parses a caller-supplied id list into unique, well-formed, count-capped uuids.
 *
 * Format-checked rather than merely non-empty: `encodeURIComponent(undefined)`
 * yields the string "undefined", which used to reach `.in('id', ids)` and make
 * Postgres reject the whole query as an invalid uuid literal — one bad client
 * value turning into a hard 500 instead of an empty result.
 */
export function parseSenderIds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => UUID_RE.test(s))
    ),
  ].slice(0, MAX_SENDER_IDS)
}

/**
 * Narrows `ids` to those that have actually posted in the Hub.
 *
 * The Hub's profile reads need the service-role key — showing who sent a message
 * means reading someone else's `profiles` row, and the `auth.uid() = id` SELECT
 * policy cannot express that. Bypassing RLS with a caller-supplied id is only
 * safe if something else bounds which ids are allowed, and nothing did: any
 * authenticated user could resolve any id in the database. This is that bound.
 *
 * Pass a *user-scoped* client. The check is that the requester can see these
 * messages themselves, which a service-role client would answer vacuously.
 */
export async function filterToHubParticipants(
  supabase: SupabaseClient,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase.rpc('hub_participant_ids', {
    p_ids: ids,
  })

  if (error) {
    // Fail closed. An unreadable participant list must not fall through to
    // resolving every id that was asked for.
    console.error('[Hub] Failed to resolve participants:', error)
    throw new Error('Failed to resolve Hub participants')
  }

  // The function returns `setof uuid`, which PostgREST renders as an array of
  // bare strings.
  return (data ?? []) as string[]
}
