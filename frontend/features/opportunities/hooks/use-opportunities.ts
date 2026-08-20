'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  searchOpportunities,
  getSearchStats,
} from '@/features/opportunities/services/opportunity-service'
import { OpportunityWithDetails, SearchFilters } from '@/types/opportunity'

interface UseOpportunitiesResult {
  opportunities: OpportunityWithDetails[]
  totalCount: number
  totalCompanies: number
  newToday: number
  postedToday: number
  importedToday: number
  isLoading: boolean
  error: string | null
}

/**
 * Client-side data fetching hook for search results.
 * Re-fetches whenever filters change.
 */
export function useOpportunities(filters: SearchFilters): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<OpportunityWithDetails[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalCompanies, setTotalCompanies] = useState(0)
  const [newToday, setNewToday] = useState(0)
  const [postedToday, setPostedToday] = useState(0)
  const [importedToday, setImportedToday] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const [searchResult, statsResult] = await Promise.all([
        searchOpportunities(supabase, filters),
        getSearchStats(supabase, filters),
      ])

      const now = new Date().getTime()
      const activeOpps = searchResult.data.filter((opp) => {
        if (opp.status && ['Closed', 'Expired'].includes(opp.status)) return false
        if (!opp.deadline) return true
        return new Date(opp.deadline).getTime() >= now
      })

      setOpportunities(activeOpps)
      setTotalCount(searchResult.count)
      setTotalCompanies(statsResult.totalCompanies)
      setNewToday(statsResult.newToday)
      setPostedToday(statsResult.postedToday)
      setImportedToday(statsResult.importedToday)
    } catch (err) {
      console.error('Failed to fetch opportunities:', err)
      setError('Failed to load opportunities. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Stable serialized filters key to avoid unnecessary re-fetches
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    // This effect kicks off an async fetch whose first statement flips a
    // loading flag. The rule fires on that synchronous setState, but moving it
    // after the await would mean the spinner only appears once the request is
    // already in flight — a worse experience traded for a green lint line.
    // Same justification convention as hub-message.tsx and tracker-board.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  return {
    opportunities,
    totalCount,
    totalCompanies,
    newToday,
    postedToday,
    importedToday,
    isLoading,
    error,
  }
}
