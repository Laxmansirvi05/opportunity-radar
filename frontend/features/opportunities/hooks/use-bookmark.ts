'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function useBookmark(opportunityId: string) {
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkSavedStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .single()

      if (data) {
        setIsSaved(true)
      }
      setIsLoading(false)
    }

    checkSavedStatus()
  }, [opportunityId, supabase])

  const toggleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert('Please sign in to save opportunities for later.')
      return
    }

    // Optimistic UI update
    const previousState = isSaved
    setIsSaved(!isSaved)
    setIsLoading(true)

    if (previousState) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)

      // Remove from tracker only if status is 'Saved'
      const { error: trackerError } = await supabase
        .from('application_tracker')
        .delete()
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .eq('status', 'Saved')

      if (error || trackerError) {
        setIsSaved(true) // revert
        console.error('Error removing bookmark', error || trackerError)
      } else {
        router.refresh()
      }
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .upsert(
          { user_id: user.id, opportunity_id: opportunityId },
          { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true }
        )

      const { error: trackerError } = await supabase
        .from('application_tracker')
        .upsert(
          { user_id: user.id, opportunity_id: opportunityId, status: 'Saved' },
          { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true }
        )

      if (error || trackerError) {
        setIsSaved(false) // revert
        console.error('Error adding bookmark:', JSON.stringify(error || trackerError))
      } else {
        router.refresh()
      }
    }

    setIsLoading(false)
  }

  return { isSaved, isLoading, toggleSave }
}
