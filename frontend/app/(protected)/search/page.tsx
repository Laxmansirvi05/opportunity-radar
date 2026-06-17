'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { SearchInput } from '@/features/opportunities/components/search/search-input'
import { SearchStatsBar } from '@/features/opportunities/components/search/search-stats-bar'
import { ActiveFiltersBar } from '@/features/opportunities/components/search/active-filters-bar'
import { SearchResultsHeader } from '@/features/opportunities/components/search/search-results-header'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import { FiltersSidebar } from '@/features/opportunities/components/search/filters-sidebar'
import { SearchEmptyState } from '@/features/opportunities/components/search/search-empty-state'
import { SearchSkeleton } from '@/features/opportunities/components/search/search-skeleton'
import { useSearchFilters } from '@/features/opportunities/hooks/use-search-filters'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useRecentSearches } from '@/features/opportunities/hooks/use-recent-searches'
import { PAGE_SIZE } from '@/types/opportunity'

function SearchPageContent() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { filters, clearSearch, resetAll, setFilter } = useSearchFilters()
  const { addRecentSearch } = useRecentSearches()
  const {
    opportunities,
    totalCount,
    totalCompanies,
    postedToday,
    importedToday,
    isLoading,
  } = useOpportunities(filters)

  const hasResults = opportunities.length > 0
  const currentPage = filters.page ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Track recent searches when q param changes
  const prevQueryRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (filters.q && filters.q !== prevQueryRef.current) {
      addRecentSearch(filters.q)
    }
    prevQueryRef.current = filters.q
  }, [filters.q, addRecentSearch])

  return (
    <>
      {/* Filters Sidebar */}
      <FiltersSidebar isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />

      {/* Search & Results Area */}
      <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0 h-full overflow-hidden">
        {/* Search Header */}
        <div className="p-4 md:p-8 border-b border-outline-variant bg-surface z-20 sticky top-0 shrink-0">
          <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
            {/* Search Input Row */}
            <div className="flex items-center gap-3">
              {/* Mobile filter toggle */}
              <button
                className="md:hidden flex items-center justify-center p-3.5 border border-outline-variant rounded-xl text-on-surface-variant bg-surface hover:bg-surface-container transition-colors shadow-sm cursor-pointer"
                onClick={() => setFiltersOpen(true)}
                aria-label="Open filters"
              >
                <span className="material-symbols-outlined">tune</span>
              </button>

              <SearchInput />
            </div>

            {/* Stats Bar */}
            <SearchStatsBar
              totalJobs={totalCount}
              totalCompanies={totalCompanies}
              postedToday={postedToday}
              importedToday={importedToday}
            />

            {/* Active Filters */}
            <ActiveFiltersBar />

            {/* Results Header */}
            <SearchResultsHeader totalCount={totalCount} query={filters.q} />
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 p-4 md:p-8 bg-surface-container-lowest overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-5 pb-24">
            {isLoading ? (
              <SearchSkeleton count={3} />
            ) : !hasResults ? (
              <SearchEmptyState
                query={filters.q}
                onClearSearch={clearSearch}
                onResetAll={resetAll}
              />
            ) : (
              <>
                {opportunities.map((opportunity) => (
                  <OpportunitySearchCard
                    key={opportunity.id}
                    opportunity={opportunity}
                  />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 pt-8">
                    <button
                      onClick={() => setFilter('page', currentPage - 1)}
                      disabled={currentPage === 0}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary border border-outline-variant rounded-xl hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      Previous
                    </button>
                    <span className="text-sm text-on-surface-variant">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setFilter('page', currentPage + 1)}
                      disabled={currentPage >= totalPages - 1}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary border border-outline-variant rounded-xl hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * /search page.
 * Wrapped in Suspense because useSearchParams() requires it in Next.js App Router.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
        <div className="p-4 md:p-8">
          <SearchSkeleton count={5} />
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}
