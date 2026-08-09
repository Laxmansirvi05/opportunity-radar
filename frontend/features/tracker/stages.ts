/**
 * Tracker stage vocabulary.
 *
 * Deliberately its own module rather than living beside the server actions: a
 * file marked `'use server'` may only export async functions, so exporting this
 * constant from there breaks the whole route at runtime — every action fails
 * and the page falls through to the error boundary.
 *
 * Shared by the board columns, the server-side stage validation, and the
 * reconciliation policy that decides which applications survive an expired
 * listing.
 */
export const TRACKER_STAGES = [
  'Saved',
  'Applied',
  'Interview Scheduled',
  'Selected',
  'Rejected',
] as const

export type TrackerStage = (typeof TRACKER_STAGES)[number]

export function isTrackerStage(value: string): value is TrackerStage {
  return (TRACKER_STAGES as readonly string[]).includes(value)
}
