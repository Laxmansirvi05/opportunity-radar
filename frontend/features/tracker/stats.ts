import type { TrackerStage } from './stages'

/**
 * Board summary numbers shown in the Tracker header.
 *
 * `applied` is the funnel total — every application that has moved past the
 * Saved column (Applied, Interview Scheduled, Selected and Rejected all count),
 * NOT just the cards sitting in the "Applied" column. `responseRate` is the
 * share of those applications that drew any employer response (an interview,
 * an offer, or a rejection — a rejection is still a response), and is `null`
 * when there is nothing applied yet so the UI can show "—" rather than a
 * misleading 0%.
 *
 * Kept as a pure function (not inlined in the board component) so the exact
 * formula the header advertises is unit-tested — see tests/tracker-stats.test.ts.
 */
export interface TrackerStats {
  total: number
  applied: number
  interviewing: number
  offers: number
  responseRate: number | null
}

export function computeTrackerStats(items: { status: TrackerStage | string }[]): TrackerStats {
  let applied = 0
  let interviewing = 0
  let offers = 0
  let responses = 0

  for (const { status } of items) {
    switch (status) {
      case 'Interview Scheduled':
        interviewing++
        responses++
        applied++
        break
      case 'Selected':
        offers++
        responses++
        applied++
        break
      case 'Rejected':
        responses++
        applied++
        break
      case 'Applied':
        applied++
        break
      // 'Saved' (and any unknown value) counts only toward `total`.
    }
  }

  return {
    total: items.length,
    applied,
    interviewing,
    offers,
    responseRate: applied > 0 ? Math.round((responses / applied) * 100) : null,
  }
}
