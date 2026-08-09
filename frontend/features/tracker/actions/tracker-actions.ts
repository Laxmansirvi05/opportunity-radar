'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Tracker mutations.
 *
 * Every action re-checks ownership with an explicit `user_id` filter rather
 * than relying on RLS alone. RLS does protect these rows, but a policy change
 * or a service-role caller would silently turn an id-only update into an IDOR;
 * the extra predicate costs nothing and removes that class of mistake.
 */

/** Stages a student can move an application through, in order. */
export const TRACKER_STAGES = [
  'Saved',
  'Applied',
  'Interview Scheduled',
  'Selected',
  'Rejected',
] as const

export type TrackerStage = (typeof TRACKER_STAGES)[number]

function isStage(value: string): value is TrackerStage {
  return (TRACKER_STAGES as readonly string[]).includes(value)
}

type ActionResult = { success: boolean; error?: string }

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function revalidateTracker() {
  revalidatePath('/tracker')
  revalidatePath('/dashboard')
}

export async function updateTrackerStatus(
  trackerId: string,
  newStatus: string
): Promise<ActionResult> {
  if (!isStage(newStatus)) {
    return { success: false, error: `Unknown stage: ${newStatus}` }
  }

  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  // Stamp the application date the first time a student reaches "Applied", so
  // the board can show how long they have been waiting on a reply.
  if (newStatus === 'Applied') {
    const { data: existing } = await supabase
      .from('application_tracker')
      .select('applied_at')
      .eq('id', trackerId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing?.applied_at) patch.applied_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('application_tracker')
    .update(patch)
    .eq('id', trackerId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Tracker] status update failed:', error.message)
    return { success: false, error: 'Could not move that application.' }
  }

  revalidateTracker()
  return { success: true }
}

export async function removeTrackerItem(trackerId: string): Promise<ActionResult> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  // Look up the opportunity first so the matching bookmark can go too —
  // otherwise removing something from the board leaves it "saved" elsewhere.
  const { data: row } = await supabase
    .from('application_tracker')
    .select('opportunity_id')
    .eq('id', trackerId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('application_tracker')
    .delete()
    .eq('id', trackerId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Tracker] remove failed:', error.message)
    return { success: false, error: 'Could not remove that application.' }
  }

  if (row?.opportunity_id) {
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('opportunity_id', row.opportunity_id)
  }

  revalidateTracker()
  return { success: true }
}

export async function updateTrackerNotes(
  trackerId: string,
  notes: string
): Promise<ActionResult> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('application_tracker')
    .update({ notes: notes.slice(0, 2000), updated_at: new Date().toISOString() })
    .eq('id', trackerId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Tracker] notes update failed:', error.message)
    return { success: false, error: 'Could not save your note.' }
  }

  revalidateTracker()
  return { success: true }
}
