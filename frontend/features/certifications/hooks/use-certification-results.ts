'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchCertificationsPage, type PriceFilter } from '../services/certification-search'
import { durationBucket, type DurationBucketKey } from '../lib/duration'
import type { Certification } from '../components/certifications-client'

const PAGE_SIZE = 48
// Duration has no stored column (see lib/duration.ts), so an active duration
// filter is applied client-side to whatever page comes back — which can
// strip a page down to very few (or zero) rows per server page if the
// combination is narrow, since results aren't sorted by duration at all.
// MAX_PAGES bounds how many pages one call scans before returning control to
// the UI, so a near-empty combination can't spin forever inside a single
// call — but see the component's `hasMore` handling: a call returning zero
// matches must NOT be treated as "no results" on its own, only as "keep
// going," or a sparse-but-real bucket looks broken. Pages are fetched in
// concurrent batches rather than one at a time — sequentially awaiting 20+
// round trips (the previous approach) took several seconds per call, which
// is indistinguishable from "broken" to someone watching a duration filter
// that hasn't found a match yet.
const MAX_PAGES = 40
const BATCH_CONCURRENCY = 8
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
      const durationActive = filters.durations.size > 0
      const maxPages = durationActive ? MAX_PAGES : 1

      let collected: Certification[] = []
      let cursor = offset
      let exhausted = false
      let total: number | null = null
      let pagesScanned = 0

      while (pagesScanned < maxPages && !exhausted && collected.length < PAGE_SIZE) {
        const batchSize = Math.min(BATCH_CONCURRENCY, maxPages - pagesScanned)
        // Offsets are computed up front (not from the previous response's
        // length), so every page in the batch can be requested at once —
        // they're independent range queries against a stable, indexed sort
        // order, not a dependent chain.
        const offsets = Array.from({ length: batchSize }, (_, i) => cursor + i * PAGE_SIZE)
        const results = await Promise.all(
          offsets.map((o) => fetchCertificationsPage(supabase, queryFilters, o, PAGE_SIZE))
        )
        if (requestIdRef.current !== requestId) return null // superseded by a newer filter/search change

        // Processed in offset order (Promise.all preserves input order
        // regardless of resolution timing), so cursor/exhaustion tracking
        // stays correct even though the requests themselves ran concurrently.
        for (const res of results) {
          if (total === null) total = res.count
          cursor += res.data.length
          pagesScanned++

          const kept = durationActive
            ? res.data.filter((c) => {
                const bucket = durationBucket(c.duration)
                return bucket != null && filters.durations.has(bucket)
              })
            : res.data
          collected = collected.concat(kept)

          if (res.data.length < PAGE_SIZE) {
            exhausted = true
            break // later offsets in this batch are past the end; their results are empty and safe to drop
          }
        }
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

    // This effect kicks off an async fetch whose first statement flips a
    // loading flag. The rule fires on that synchronous setState, but moving it
    // after the await would mean the spinner only appears once the request is
    // already in flight — a worse experience traded for a green lint line.
    // Same justification convention as hub-message.tsx and tracker-board.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
