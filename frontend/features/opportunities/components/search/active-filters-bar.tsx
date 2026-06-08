'use client'

import { useSearchFilters } from '@/features/opportunities/hooks/use-search-filters'
import { SearchFilters } from '@/types/opportunity'

/**
 * Active filter chips row with individual ✕ dismiss and "Clear all" button.
 * Per Stitch design: only visible when filters are active.
 */
export function ActiveFiltersBar() {
  const { activeFilterChips, hasActiveFilters, clearAllFilters, toggleArrayFilter, clearFilter } =
    useSearchFilters()

  if (!hasActiveFilters) return null

  const handleRemoveChip = (chip: { key: string; value: string }) => {
    const arrayKeys = ['category', 'mode', 'experience_level', 'tags']
    if (arrayKeys.includes(chip.key)) {
      toggleArrayFilter(chip.key as 'category' | 'mode' | 'experience_level' | 'tags', chip.value)
    } else {
      clearFilter(chip.key as keyof SearchFilters)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant mr-1">
        Active Filters:
      </span>
      {activeFilterChips.map((chip, index) => (
        <div
          key={`${chip.key}-${chip.value}-${index}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant text-on-surface text-xs font-medium"
        >
          <span>{chip.label}</span>
          <button
            onClick={() => handleRemoveChip(chip)}
            className="hover:text-error transition-colors flex items-center cursor-pointer"
            aria-label={`Remove ${chip.label} filter`}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
      <button
        onClick={clearAllFilters}
        className="text-primary hover:text-primary-container text-xs font-medium ml-2 hover:underline transition-all cursor-pointer"
      >
        Clear all
      </button>
    </div>
  )
}
