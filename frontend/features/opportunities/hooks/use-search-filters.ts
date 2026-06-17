'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useRef, useEffect, useMemo, startTransition } from 'react'
import { SearchFilters } from '@/types/opportunity'

/**
 * URL-based search filter state management.
 *
 * All filter state lives in URL query params — no component-local state.
 * Per App-Flow §5.5, Line 364:
 *   "All search and filter state lives in the URL query string only."
 *
 * Provides 300ms debounce on the q (search query) param per App-Flow Line 320.
 */
export function useSearchFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // ── Read current filters from URL ─────────────────────────────────
  const filters: SearchFilters = useMemo(() => {
    const q = searchParams.get('q') || undefined
    const category = searchParams.getAll('category')
    const mode = searchParams.getAll('mode')
    const is_paid_raw = searchParams.get('is_paid')
    const experience_level = searchParams.getAll('experience_level')
    const fresh = searchParams.get('fresh') || undefined
    const deadline = searchParams.get('deadline') || undefined
    const location = searchParams.get('location') || undefined
    const tags = searchParams.getAll('tags')
    const company = searchParams.get('company') || undefined
    const sort = searchParams.get('sort') as SearchFilters['sort'] || undefined
    const pageRaw = searchParams.get('page')
    const page = pageRaw ? parseInt(pageRaw, 10) : 0

    return {
      q,
      category: category.length > 0 ? category : undefined,
      mode: mode.length > 0 ? mode : undefined,
      is_paid: is_paid_raw !== null ? is_paid_raw === 'true' : undefined,
      fresh,
      deadline,
      location,
      tags: tags.length > 0 ? tags : undefined,
      company,
      sort,
      page,
    }
  }, [searchParams])

  // ── Build URLSearchParams from filters ────────────────────────────
  const buildParams = useCallback(
    (updates: Partial<SearchFilters>): URLSearchParams => {
      const merged = { ...filters, ...updates }
      const params = new URLSearchParams()

      if (merged.q) params.set('q', merged.q)
      if (merged.category) merged.category.forEach((c) => params.append('category', c))
      if (merged.mode) merged.mode.forEach((m) => params.append('mode', m))
      if (merged.is_paid !== undefined) params.set('is_paid', String(merged.is_paid))
      if (merged.fresh) params.set('fresh', merged.fresh)
      if (merged.deadline) params.set('deadline', merged.deadline)
      if (merged.location) params.set('location', merged.location)
      if (merged.tags) merged.tags.forEach((t) => params.append('tags', t))
      if (merged.company) params.set('company', merged.company)
      if (merged.sort) params.set('sort', merged.sort)
      // Reset page to 0 on any filter change, unless page itself is being set
      if ('page' in updates && updates.page && updates.page > 0) {
        params.set('page', String(updates.page))
      }

      return params
    },
    [filters]
  )

  // ── Set a single filter value ─────────────────────────────────────
  const setFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      const updates = { [key]: value } as Partial<SearchFilters>
      if (key !== 'page') updates.page = 0
      const params = buildParams(updates)
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [buildParams, pathname, router]
  )

  // ── Set search query with 300ms debounce ──────────────────────────
  const setSearchQuery = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        const params = buildParams({
          q: query || undefined,
          page: 0,
        })
        startTransition(() => {
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        })
      }, 300)
    },
    [buildParams, pathname, router]
  )

  // ── Toggle a value in an array filter (category, mode, etc.) ──────
  const toggleArrayFilter = useCallback(
    (key: 'category' | 'mode' | 'experience_level' | 'tags', value: string) => {
      const current = filters[key] ?? []
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      setFilter(key, updated.length > 0 ? updated : undefined)
    },
    [filters, setFilter]
  )

  // ── Remove a single filter ────────────────────────────────────────
  const clearFilter = useCallback(
    (key: keyof SearchFilters) => {
      const params = buildParams({ [key]: undefined, page: 0 })
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [buildParams, pathname, router]
  )

  // ── Clear all filters but preserve q (App-Flow Line 347) ──────────
  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }, [pathname, router])

  // ── Clear search but preserve filters (App-Flow Line 353) ─────────
  const clearSearch = useCallback(() => {
    const params = buildParams({ q: undefined, page: 0 })
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }, [buildParams, pathname, router])

  // ── Reset everything (App-Flow Line 359) ──────────────────────────
  const resetAll = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }, [pathname, router])

  // ── Check if any filters are active ───────────────────────────────
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.category?.length ||
      filters.mode?.length ||
      filters.is_paid !== undefined ||
      filters.fresh ||
      filters.deadline ||
      filters.location ||
      filters.tags?.length ||
      filters.company
    )
  }, [filters])

  // ── Get active filter list for chips display ──────────────────────
  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof SearchFilters; label: string; value: string }[] = []

    filters.category?.forEach((c) => chips.push({ key: 'category', label: c, value: c }))
    filters.mode?.forEach((m) => chips.push({ key: 'mode', label: m, value: m }))
    if (filters.is_paid !== undefined) {
      chips.push({ key: 'is_paid', label: filters.is_paid ? 'Paid' : 'Free', value: String(filters.is_paid) })
    }
    if (filters.fresh) {
      const labels: Record<string, string> = { '1h': 'Last Hour', '6h': 'Last 6 Hours', '24h': 'Last 24 Hours', '7d': 'Last 7 Days' }
      chips.push({ key: 'fresh', label: labels[filters.fresh] ?? filters.fresh, value: filters.fresh })
    }
    if (filters.deadline) {
      const labels: Record<string, string> = { '24h': 'Next 24h', '1w': '1 week', '1m': '1 month' }
      chips.push({ key: 'deadline', label: labels[filters.deadline] ?? filters.deadline, value: filters.deadline })
    }
    if (filters.location) {
      chips.push({ key: 'location', label: filters.location, value: filters.location })
    }
    filters.tags?.forEach((t) => chips.push({ key: 'tags', label: t, value: t }))
    if (filters.company) {
      chips.push({ key: 'company', label: filters.company, value: filters.company })
    }

    return chips
  }, [filters])

  return {
    filters,
    setFilter,
    setSearchQuery,
    toggleArrayFilter,
    clearFilter,
    clearAllFilters,
    clearSearch,
    resetAll,
    hasActiveFilters,
    activeFilterChips,
  }
}
