'use client'

/**
 * Empty state for search results.
 * Per App-Flow Line 964: "No results for '[query]'." with "Clear search" button.
 */
interface SearchEmptyStateProps {
  query?: string
  onClearSearch?: () => void
  onResetAll?: () => void
}

export function SearchEmptyState({ query, onClearSearch, onResetAll }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[60vh] px-4 text-center pb-12">
      <div className="w-24 h-24 rounded-3xl bg-surface-container flex items-center justify-center mb-6 shadow-sm border border-outline-variant/40">
        <span className="material-symbols-outlined text-on-surface-variant opacity-80" style={{ fontSize: 48 }}>
          search_off
        </span>
      </div>
      <h3 className="text-2xl font-bold text-on-background mb-3 tracking-tight">
        {query ? `No results for "${query}"` : 'No opportunities found'}
      </h3>
      <p className="text-base text-on-surface-variant w-full max-w-[448px] mx-auto mb-8 leading-relaxed">
        Try changing your search or filters
      </p>
      <div className="flex items-center gap-4">
        {query && onClearSearch && (
          <button
            onClick={onClearSearch}
            className="px-6 py-3 text-sm font-semibold text-on-surface border border-outline-variant bg-surface rounded-xl hover:bg-surface-container transition-colors cursor-pointer shadow-sm"
          >
            Clear search
          </button>
        )}
        {onResetAll && (
          <button
            onClick={onResetAll}
            className="px-6 py-3 text-sm font-semibold text-on-primary bg-primary rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  )
}
