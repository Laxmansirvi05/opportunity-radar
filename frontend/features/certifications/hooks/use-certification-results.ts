'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchCertificationsPage, type PriceFilter } from '../services/certification-search'
import { durationBucket, type DurationBucketKey } from '../lib/duration'
import type { Certification } from '../components/certifications-client'

const PAGE_SIZE = 48
// Duration has no stored column (see lib/duration.ts), so an active duration
// filter is applied client-side to whatever page comes back — which can
// strip a page down to very few rows if the combination is narrow. This
// bounds how many extra server round-trips one load-more will chase before
// giving up on filling a full page, so a near-empty combination can't spin.
const MAX_CONTINUATIONS = 8
const DEBOUNCE_MS = 200

export interface CertificationFiltersState {
  query: string
  price: PriceFilter
  levels: Set<string>
  providers: Set<string>
  durations: Set<DurationBucketKey>
}

function isDefaultFilters(f: CertificationFiltersState): boolean {
  return !f.query.trim() && f.price === 'all' && f.levels.size === 0 && f.providers.size === 0 && f.durations.size === 0
}

function filtersKey(f: CertificationFiltersState): string {
  return [
    f.query.trim().toLowerCase(),
    f.price,
    [...f.levels].sort().join(','),
    [...f.providers].sort().join(','),
    [...f.durations].sort().join(','),
  ].join('|')
}

interface ContinuationResult {
  collected: Certification[]
  cursor: number
  exhausted: boolean
  total: number | null
}

/**
 * Drives the certifications list from the server rather than filtering an
 * in-memory copy of the whole catalogue — see get-catalogue.ts for why
 * shipping all 13,000+ rows to every visitor was the actual root cause of
 * the page feeling slow. The unfiltered first screen reuses the SSR-fetched
 * `seed` (zero network round-trip); any search or filter beyond that queries
 * Supabase directly, same pattern as the opportunities search's
 * `useOpportunities` hook.
 */
export function useCertificationResults(
  filters: CertificationFiltersState,
  seed: Certification[],
  seedTotal: number
) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Certification[]>(seed)
  const [total, setTotal] = useState<number | null>(seedTotal)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(seed.length < seedTotal)

  const offsetRef = useRef(seed.length)
  const requestIdRef = useRef(0)
  const key = filtersKey(filters)

  const runContinuation = useCallback(
    async (offset: number, requestId: number): Promise<ContinuationResult | null> => {
      const queryFilters = {
        query: filters.query,
        price: filters.price,
        levels: [...filters.levels],
        providers: [...filters.providers],
      }
      const attempts = filters.durations.size > 0 ? MAX_CONTINUATIONS : 1

      let collected: Certification[] = []
      let cursor = offset
      let exhausted = false
      let total: number | null = null

      for (let i = 0; i < attempts; i++) {
        const res = await fetchCertificationsPage(supabase, queryFilters, cursor, PAGE_SIZE)
        if (requestIdRef.current !== requestId) return null // superseded by a newer filter/search change

        if (total === null) total = res.count
        cursor += res.data.length

        const kept =
          filters.durations.size > 0
            ? res.data.filter((c) => {
                const bucket = durationBucket(c.duration)
                return bucket != null && filters.durations.has(bucket)
              })
            : res.data
        collected = collected.concat(kept)

        if (res.data.length < PAGE_SIZE) {
          exhausted = true
          break
        }
        if (collected.length >= PAGE_SIZE) break
      }

      return { collected, cursor, exhausted, total }
    },
    [supabase, filters.query, filters.price, filters.levels, filters.providers, filters.durations]
  )

  // Reset to the default (no filter, no query) view during render, not in an
  // effect — this is React's documented pattern for "some value changed, so
  // derived state must change too" (https://react.dev/learn/you-might-not-need-an-effect).
  // It reuses the SSR seed instead of re-fetching rows the server already
  // sent down with the page, and — being a plain state update, not a ref
  // mutation — is safe to run during render. Refs are only ever touched from
  // the effect below, never here.
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey && isDefaultFilters(filters)) {
    setPrevKey(key)
    setItems(seed)
    setTotal(seedTotal)
    setHasMore(seed.length < seedTotal)
    setLoading(false)
  } else if (key !== prevKey) {
    setPrevKey(key)
  }

  // Handles every non-default filter/search change: fetching is
  // unavoidably async, which is exactly what effects are for. This also
  // owns every ref write (offsetRef/requestIdRef) — refs must never be
  // mutated during render, only from effects or event handlers.
  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (isDefaultFilters(filters)) {
      offsetRef.current = seed.length
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      const result = await runContinuation(0, requestId)
      if (!result || requestIdRef.current !== requestId) return
      setItems(result.collected)
      setTotal(result.total)
      setHasMore(!result.exhausted)
      offsetRef.current = result.cursor
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    const requestId = requestIdRef.current
    setLoading(true)
    const result = await runContinuation(offsetRef.current, requestId)
    if (!result || requestIdRef.current !== requestId) {
      setLoading(false)
      return
    }
    setItems((prev) => prev.concat(result.collected))
    setHasMore(!result.exhausted)
    offsetRef.current = result.cursor
    if (result.total != null) setTotal(result.total)
    setLoading(false)
  }, [loading, hasMore, runContinuation])

  return { items, total, loading, hasMore, loadMore }
}
