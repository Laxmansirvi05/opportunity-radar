'use client'

import { useState, useCallback } from 'react'

const RECENT_KEY = 'opportunity-radar-recent-searches'
const MAX_RECENT = 5

/**
 * Hook for Recent Searches backed by localStorage.
 */
export function useRecentSearches() {
  // Read once in a lazy initialiser rather than an effect: this hook is
  // client-only ('use client' above), so there is no server render to
  // disagree with, and loading in an effect meant one render with an empty
  // list before the stored searches appeared.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const recent = localStorage.getItem(RECENT_KEY)
      return recent ? (JSON.parse(recent) as string[]) : []
    } catch {
      // A corrupt entry just means "no history".
      return []
    }
  })

  // ── Track a recent search ─────────────────────────────────────────
  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return
    setRecentSearches((prev) => {
      const filtered = prev.filter((q) => q !== query)
      const next = [query, ...filtered].slice(0, MAX_RECENT)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // ── Clear recent searches ─────────────────────────────────────────
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_KEY)
  }, [])

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  }
}
