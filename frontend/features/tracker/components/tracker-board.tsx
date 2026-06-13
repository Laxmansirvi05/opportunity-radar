'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateTrackerStatus, removeTrackerItem } from '../actions/tracker-actions'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'

export type TrackerItem = {
  id: string
  status: string
  saved_at: string
  applied_at: string | null
  opportunity_id: string
  title: string
  location: string | null
  mode: string | null
  company_name: string
  company_logo: string | null
}

const STATUS_MAP = [
  { db: 'Saved', ui: 'Saved' },
  { db: 'Applied', ui: 'Applied' },
  { db: 'Interview Scheduled', ui: 'Interviewing' },
  { db: 'Selected', ui: 'Offer' },
  { db: 'Rejected', ui: 'Rejected' }
]

const formatDate = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const y = date.getUTCFullYear()
  return `${m}/${d}/${y}`
}

export function TrackerBoard({ initialData }: { initialData: TrackerItem[] }) {
  const [data, setData] = useState<TrackerItem[]>(initialData)
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = async (trackerId: string, newStatus: string) => {
    // Optimistic update
    setData((prev) =>
      prev.map((item) =>
        item.id === trackerId ? { ...item, status: newStatus } : item
      )
    )

    startTransition(async () => {
      const result = await updateTrackerStatus(trackerId, newStatus)
      if (!result.success) {
        // Revert on failure
        setData(initialData)
      }
    })
  }

  const handleRemove = async (trackerId: string) => {
    setData((prev) => prev.filter((item) => item.id !== trackerId))
    startTransition(async () => {
      const result = await removeTrackerItem(trackerId)
      if (!result.success) {
        setData(initialData)
      }
    })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full pb-4 overflow-y-auto lg:overflow-x-auto">
      {STATUS_MAP.map(({ db: dbStatus, ui: uiStatus }) => {
        const columnItems = data.filter((item) => item.status === dbStatus)

        return (
          <div key={dbStatus} className="flex flex-col w-full lg:w-[320px] shrink-0 lg:h-full min-h-[300px]">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-bold text-sm text-on-surface-variant uppercase tracking-wider">
                {uiStatus}
              </h3>
              <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full text-xs font-semibold">
                {columnItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {columnItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo
                      src={item.company_logo}
                      alt={item.company_name}
                      containerClassName="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/50"
                      imageClassName="w-6 h-6 object-contain"
                      fallbackIconClassName="material-symbols-outlined text-[20px] text-on-surface-variant"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <Link
                        href={`/opportunities/${item.opportunity_id}`}
                        className="font-bold text-sm text-on-surface hover:text-primary transition-colors truncate"
                      >
                        {item.title}
                      </Link>
                      <span className="text-xs text-on-surface-variant truncate">
                        {item.company_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRemove(item.id)}
                        disabled={isPending}
                        className="text-on-surface-variant hover:text-[#D93025] transition-colors p-1 rounded hover:bg-[#FCE8E6] disabled:opacity-50 cursor-pointer flex items-center justify-center"
                        aria-label="Remove item"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {formatDate(item.saved_at)}
                      </span>
                    </div>

                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      disabled={isPending}
                      className="text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 max-w-[120px] truncate"
                    >
                      {STATUS_MAP.map(({ db, ui }) => (
                        <option key={db} value={db}>
                          {ui}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              
              {columnItems.length === 0 && (
                <div className="border-2 border-dashed border-outline-variant rounded-xl h-24 flex items-center justify-center">
                  <span className="text-xs text-on-surface-variant font-medium">No items</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
