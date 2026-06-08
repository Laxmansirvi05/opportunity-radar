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

      setOpportunities(searchResult.data)
      setTotalCount(searchResult.count)
      setTotalCompanies(statsResult.totalCompanies)
      setNewToday(statsResult.newToday)
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
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  return {
    opportunities,
    totalCount,
    totalCompanies,
    newToday,
    isLoading,
    error,
  }
}
