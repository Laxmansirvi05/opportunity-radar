'use client'

import React, { useState, useEffect } from 'react'
import { useSearchFilters } from '@/features/opportunities/hooks/use-search-filters'

/**
 * Full-width search input matching the Stitch design.
 * Material icon `search` left, `close` button right.
 * 300ms debounced URL updates.
 */
export const SearchInput = React.memo(function SearchInput() {
  const { filters, setSearchQuery, clearSearch } = useSearchFilters()
  const [localValue, setLocalValue] = useState(filters.q ?? '')

  // Sync local value when URL changes externally (e.g. back button)
  // We only sync if the local value is empty and the URL has a value,
  // or if the URL is cleared. We avoid syncing during active typing.
  useEffect(() => {
    if (!filters.q && localValue !== '') {
      setLocalValue('')
    } else if (filters.q && localValue === '') {
      setLocalValue(filters.q)
    }
    // localValue is intentionally NOT a dep: this syncs only when the URL's q
    // changes (back button, cleared filter). Adding localValue would re-run it
    // on every keystroke and fight the user's active typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalValue(value)
    setSearchQuery(value)
  }

  const handleClear = () => {
    setLocalValue('')
    clearSearch()
  }

  return (
    <div className="relative flex-1 group">
      <span
        className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
        style={{ fontSize: 24 }}
      >
        search
      </span>
      <input
        id="search-input"
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="Search roles, companies, or keywords..."
        className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-outline-variant bg-surface text-on-background font-sans text-base focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none shadow-sm hover:border-outline transition-all"
        autoComplete="off"
      />
      {localValue.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-variant rounded-full p-1.5 transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  )
})
