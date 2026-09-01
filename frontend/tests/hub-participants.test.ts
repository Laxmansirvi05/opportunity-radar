import { describe, it, expect, vi } from 'vitest'
import {
  parseSenderIds,
  filterToHubParticipants,
  MAX_SENDER_IDS,
  UUID_RE,
} from '@/features/hub/lib/hub-participants'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

describe('parseSenderIds', () => {
  it('parses a comma-separated list', () => {
    expect(parseSenderIds(`${A},${B}`)).toEqual([A, B])
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseSenderIds(` ${A} , ${B} `)).toEqual([A, B])
  })

  it('deduplicates', () => {
    expect(parseSenderIds(`${A},${A},${B}`)).toEqual([A, B])
  })

  it('returns nothing for an empty string', () => {
    expect(parseSenderIds('')).toEqual([])
  })

  /**
   * The regression this exists for: a realtime payload arrived without a
   * sender_id, `encodeURIComponent(undefined)` produced the literal string
   * "undefined", and it reached `.in('id', ids)`. Postgres rejects the whole
   * statement on an invalid uuid literal, so one malformed event became a 500
   * that took the page down rather than an empty result.
   */
  it('drops values that are not uuids', () => {
    expect(parseSenderIds('undefined')).toEqual([])
    expect(parseSenderIds('null,,not-a-uuid,12345')).toEqual([])
    expect(parseSenderIds(`undefined,${A}`)).toEqual([A])
  })

  it('drops a uuid with the wrong shape', () => {
    // Right characters, wrong grouping.
    expect(parseSenderIds('11111111-1111-4111-8111-11111111111')).toEqual([])
    expect(parseSenderIds(`${A}extra`)).toEqual([])
  })

  it('caps the list so one request cannot ask about the whole user base', () => {
    const many = Array.from(
      { length: MAX_SENDER_IDS + 50 },
      (_, i) => `1111111${(i % 10)}-1111-4111-8111-${String(i).padStart(12, '0')}`
    )
    expect(parseSenderIds(many.join(','))).toHaveLength(MAX_SENDER_IDS)
  })

  it('accepts uppercase uuids', () => {
    expect(UUID_RE.test(A.toUpperCase())).toBe(true)
  })
})

/**
 * The bound that was missing. Both Hub profile reads use the service-role key to
 * get past the `auth.uid() = id` policy on `profiles`, with the id supplied by
 * the caller — so without this narrowing, any authenticated user could resolve
 * name, avatar, LinkedIn and email for any id in the database.
 */
describe('filterToHubParticipants', () => {
  function clientReturning(result: { data?: unknown; error?: unknown }) {
    return { rpc: vi.fn().mockResolvedValue(result) } as never
  }

  it('returns only the ids the room reports back', async () => {
    const client = clientReturning({ data: [A], error: null })
    await expect(filterToHubParticipants(client, [A, B])).resolves.toEqual([A])
  })

  it('asks the database rather than filtering in application code', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [A], error: null }) }
    await filterToHubParticipants(client as never, [A, B])
    expect(client.rpc).toHaveBeenCalledWith('hub_participant_ids', { p_ids: [A, B] })
  })

  it('short-circuits an empty list without a round trip', async () => {
    const client = { rpc: vi.fn() }
    await expect(filterToHubParticipants(client as never, [])).resolves.toEqual([])
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('treats nobody as a participant when the room returns nothing', async () => {
    const client = clientReturning({ data: [], error: null })
    await expect(filterToHubParticipants(client, [A, B, C])).resolves.toEqual([])
  })

  it('handles a null payload as nobody rather than everybody', async () => {
    const client = clientReturning({ data: null, error: null })
    await expect(filterToHubParticipants(client, [A])).resolves.toEqual([])
  })

  /**
   * Fails closed. Falling through to the requested list on error would restore
   * the exact vulnerability this function exists to close, and would do it only
   * while the database was unhealthy — the hardest case to notice.
   */
  it('throws rather than falling back to the requested ids', async () => {
    const client = clientReturning({ data: null, error: { message: 'boom' } })
    await expect(filterToHubParticipants(client, [A, B])).rejects.toThrow(
      /Failed to resolve Hub participants/
    )
  })
})
