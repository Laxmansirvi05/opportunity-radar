'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useBookmark(opportunityId: string) {
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const checkSavedStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!isMounted) return

      if (!user) {
        setIsLoading(false)
        return
      }
      
      setUserId(user.id)

      const { data } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .single()

      if (isMounted) {
        if (data) setIsSaved(true)
        setIsLoading(false)
      }
    }

    checkSavedStatus()

    return () => {
      isMounted = false
    }
  }, [opportunityId, supabase])

  const toggleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!userId) {
      alert('Please sign in to save opportunities for later.')
      return
    }

    // 1. Optimistic UI update (Instant)
    const previousState = isSaved
    setIsSaved(!previousState)
    // We intentionally DO NOT set isLoading(true) to keep the UI responsive

    // 2. Background Database Mutations
    if (previousState) {
      // User is un-saving
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)

      // Remove from tracker only if status is 'Saved'
      const { error: trackerError } = await supabase
        .from('application_tracker')
        .delete()
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)
        .eq('status', 'Saved')

      if (error || trackerError) {
        setIsSaved(true) // Revert to saved
        console.error('Error removing bookmark', error || trackerError)
      }
    } else {
      // User is saving
      const { error } = await supabase
        .from('bookmarks')
        .upsert(
          { user_id: userId, opportunity_id: opportunityId },
          { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true }
        )

      const { error: trackerError } = await supabase
        .from('application_tracker')
        .upsert(
          { user_id: userId, opportunity_id: opportunityId, status: 'Saved' },
          { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true }
        )

      if (error || trackerError) {
        setIsSaved(false) // Revert to not saved
        console.error('Error adding bookmark:', error || trackerError)
      }
    }
  }

  return { isSaved, isLoading, toggleSave }
}
