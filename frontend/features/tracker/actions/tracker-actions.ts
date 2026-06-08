'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTrackerStatus(trackerId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('application_tracker')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', trackerId)

  if (error) {
    console.error('Failed to update status', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/tracker')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function removeTrackerItem(trackerId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('application_tracker')
    .delete()
    .eq('id', trackerId)

  if (error) {
    console.error('Failed to remove item', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/tracker')
  revalidatePath('/dashboard')
  return { success: true }
}
