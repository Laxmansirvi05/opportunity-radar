'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markAsApplied(opportunityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // 1. Check if it already exists in the tracker
  const { data: existing } = await supabase
    .from('application_tracker')
    .select('id')
    .eq('user_id', user.id)
    .eq('opportunity_id', opportunityId)
    .maybeSingle()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('application_tracker')
      .update({
        status: 'Applied',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    if (error) {
      console.error('Error updating tracker:', error)
      return { error: 'Failed to update application tracker.' }
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from('application_tracker')
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId,
        status: 'Applied',
        applied_at: new Date().toISOString(),
        saved_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error inserting into tracker:', error)
      return { error: 'Failed to add to application tracker.' }
    }
  }

  // Also remove from bookmarks if they are mutually exclusive, or just leave it.
  // The requirements say: "Saved -> Applied or Create Applied entry".
  // Bookmarks are for "Saved for later". Tracker is for full tracking.
  // Since Tracker and Bookmarks are separate tables, let's remove from bookmarks to keep "Saved for Later" clean.
  await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('opportunity_id', opportunityId)

  // 2. Revalidate paths
  revalidatePath('/dashboard')
  revalidatePath('/tracker')
  revalidatePath(`/opportunities/${opportunityId}`)

  return { success: true }
}
