'use client'

import { useState, useEffect, useCallback } from 'react'

const RECENT_KEY = 'opportunity-radar-recent-searches'
const MAX_RECENT = 5

/**
 * Hook for Recent Searches backed by localStorage.
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const recent = localStorage.getItem(RECENT_KEY)
      if (recent) setRecentSearches(JSON.parse(recent))
    } catch {
      // Silently handle corrupted localStorage
    }
  }, [])

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
