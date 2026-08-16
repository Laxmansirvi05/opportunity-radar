'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
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

      // maybeSingle, not single: "not yet bookmarked" is the common case
      // (zero rows), and single() treats zero rows as a 406 error — which
      // was firing on every unbookmarked card, every page load.
      const { data } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .maybeSingle()

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
      // A native alert() blocks the whole page and looks out of place next
      // to every other notification in the app now that a real Toaster is
      // mounted globally (previously the only one lived on the Resume
      // Builder page, so nothing outside it — including this — could use
      // toast() at all).
      toast.error('Please sign in to save opportunities for later.')
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
        toast.error('Could not remove this bookmark. Please try again.')
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
        toast.error('Could not save this opportunity. Please try again.')
      }
    }
  }

  return { isSaved, isLoading, toggleSave }
}
