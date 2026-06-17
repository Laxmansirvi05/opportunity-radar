'use client'

import React from 'react'

/**
 * Blue-tinted stats bar showing result counts.
 * Matches the Stitch design row: "{count} Jobs · {companies} Companies · {newToday} New Today"
 */
interface SearchStatsBarProps {
  totalJobs: number
  totalCompanies: number
  postedToday: number
  importedToday: number
}

/**
 * Simple stats bar below the search input.
 * Displays total count, companies, and new today.
 */
export const SearchStatsBar = React.memo(function SearchStatsBar({
  totalJobs,
  totalCompanies,
  postedToday,
  importedToday,
}: SearchStatsBarProps) {
  return (
    <div className="flex items-center gap-6 py-3 px-4 bg-surface-container-low rounded-xl border border-outline-variant/50">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">work</span>
        <span className="text-xs font-medium tracking-wide text-on-surface">
          <span className="font-bold">{totalJobs.toLocaleString()}</span> Jobs
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">business</span>
        <span className="text-xs font-medium tracking-wide text-on-surface">
          <span className="font-bold">{totalCompanies.toLocaleString()}</span> Companies
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">calendar_today</span>
        <span className="text-xs font-medium tracking-wide text-on-surface">
          <span className="font-bold text-secondary">{postedToday.toLocaleString()}</span> Posted Today
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">cloud_download</span>
        <span className="text-xs font-medium tracking-wide text-on-surface">
          <span className="font-bold text-secondary">{importedToday.toLocaleString()}</span> Imported Today
        </span>
      </div>
    </div>
  )
})
