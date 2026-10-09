'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const RECENT_KEY = 'opportunity-radar-recent-searches'
const MAX_RECENT = 5
const CHANGE_EVENT = 'opportunity-radar:recent-searches'
const EMPTY = '[]'

function readRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? EMPTY
  } catch {
    // Storage blocked (private mode, cleared site data): no history.
    return EMPTY
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string') : []
  } catch {
    // A corrupt entry just means "no history".
    return []
  }
}

function write(next: string[]): void {
  try {
    if (next.length === 0) localStorage.removeItem(RECENT_KEY)
    else localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Nothing to do if storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Recent searches, kept in localStorage.
 *
 * Read through useSyncExternalStore with an empty server snapshot. A
 * 'use client' component is still rendered on the server, where there is no
 * localStorage, so the earlier lazy useState initialiser produced an empty
 * list on the server and a filled one in the browser. For anyone with search
 * history that was a hydration mismatch (React error #418) on every visit to
 * /search, which threw away the server-rendered results area.
 */
export function useRecentSearches() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY)
  const recentSearches = useMemo(() => parse(raw), [raw])

  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return
    const filtered = parse(readRaw()).filter((q) => q !== query)
    write([query, ...filtered].slice(0, MAX_RECENT))
  }, [])

  const clearRecentSearches = useCallback(() => {
    write([])
  }, [])

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  }
}
