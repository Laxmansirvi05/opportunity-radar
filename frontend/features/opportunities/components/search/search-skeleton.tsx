'use client'

/**
 * Skeleton loading state for search results.
 * Matches the opportunity card layout with animated pulse placeholders.
 */
export function SearchSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-outline-variant rounded-2xl p-6 flex flex-col gap-5 animate-pulse"
        >
          {/* Header skeleton */}
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface-container" />
              <div className="flex flex-col justify-center gap-2">
                <div className="h-5 w-48 bg-surface-container rounded" />
                <div className="h-4 w-32 bg-surface-container rounded" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container" />
          </div>

          {/* Tags skeleton */}
          <div className="flex gap-2">
            <div className="h-7 w-16 bg-surface-container rounded-lg" />
            <div className="h-7 w-20 bg-surface-container rounded-lg" />
            <div className="h-7 w-14 bg-surface-container rounded-lg" />
          </div>

          {/* Footer skeleton */}
          <div className="flex justify-between items-center border-t border-outline-variant/60 pt-4">
            <div className="h-4 w-28 bg-surface-container rounded" />
            <div className="h-8 w-32 bg-surface-container rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
