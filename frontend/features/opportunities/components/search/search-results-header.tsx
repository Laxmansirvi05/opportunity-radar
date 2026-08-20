'use client'

import { useSearchFilters } from '@/features/opportunities/hooks/use-search-filters'
import type { SearchFilters } from '@/types/opportunity'

/**
 * Results count text and sort dropdown.
 */
interface SearchResultsHeaderProps {
  totalCount: number
  query?: string
}

export function SearchResultsHeader({ totalCount, query }: SearchResultsHeaderProps) {
  const { filters, setFilter } = useSearchFilters()

  return (
    <div className="flex justify-between items-center mt-2">
      <p className="text-sm text-on-surface-variant">
        Showing{' '}
        <span className="font-semibold text-on-background">
          {totalCount.toLocaleString()}
        </span>{' '}
        results
        {query ? (
          <>
            {' '}
            for &ldquo;<span className="font-semibold text-on-background">{query}</span>&rdquo;
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-on-surface-variant">Sort by:</span>
        <div className="relative">
          <select
            className="appearance-none bg-transparent border-none text-on-background text-xs font-semibold cursor-pointer focus:ring-0 p-0 pr-6 hover:text-primary transition-colors outline-none"
            value={filters.sort ?? 'relevance'}
            onChange={(e) => setFilter('sort', e.target.value as SearchFilters['sort'])}
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="deadline">Closing Soon</option>
          </select>
          <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-on-surface pointer-events-none text-[18px]">
            expand_more
          </span>
        </div>
      </div>
    </div>
  )
}
