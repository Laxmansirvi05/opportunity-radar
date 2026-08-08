/**
 * Reconciliation — removing opportunities that are no longer real.
 *
 * Policy (agreed with the product owner):
 *
 *   • An opportunity whose deadline has passed, or which has disappeared from
 *     its source, is DELETED outright. Storage is not spent on dead listings,
 *     and a student must never see something they cannot act on.
 *
 *   • Deleting cascades (ON DELETE CASCADE) to bookmarks, recently_viewed and
 *     application_tracker, which is what we want for a merely *saved* listing.
 *
 *   • EXCEPT where a student has progressed past "Saved" — Applied, Interview
 *     Scheduled, Selected or Rejected. That row is their own application
 *     history, and deleting the opportunity would erase it. Those are marked
 *     Expired and kept.
 *
 * Two safety rules apply throughout:
 *
 *   1. If we cannot determine which opportunities are protected, we delete
 *     NOTHING. A permissions failure must never become data loss.
 *   2. Source reconciliation only runs when a run looks complete. A partially
 *     failed scrape would otherwise wipe an entire source from the catalogue.
 */

/** Tracker stages that represent real student effort and must be preserved. */
export const PROTECTED_TRACKER_STAGES = [
  'Applied',
  'Interview Scheduled',
  'Selected',
  'Rejected',
] as const

/** Minimum share of the previous run's volume before we trust a run enough to
 *  delete anything it did not see. */
export const RECONCILE_MIN_COVERAGE = 0.6

export interface ReconcileResult {
  deleted: number
  preserved: number
  skipped: boolean
  reason: string
}

/** The slice of a Supabase client this module uses. Loosely typed on purpose:
 *  the query builder is chainable and thenable, and pinning it exactly would
 *  couple this module to a specific supabase-js version. */
export interface QueryError {
  message?: string
}

export interface QueryResult {
  data: Record<string, unknown>[] | null
  error: QueryError | null
  count?: number | null
}

export interface QueryChain {
  select: (cols?: string) => QueryChain
  delete: (opts?: { count?: 'exact' }) => QueryChain
  update: (payload: Record<string, unknown>) => QueryChain
  eq: (col: string, val: unknown) => QueryChain
  not: (col: string, op: string, val: unknown) => QueryChain
  lt: (col: string, val: unknown) => QueryChain
  or: (filter: string) => QueryChain
  in: (col: string, vals: readonly unknown[]) => QueryChain
  range: (from: number, to: number) => QueryChain
  then: (resolve: (value: QueryResult) => void) => void
}

export interface Db {
  from: (table: string) => QueryChain
}

/**
 * Opportunity ids that must not be hard-deleted because a student has already
 * acted on them.
 *
 * Returns null — meaning "unknown, do not delete anything" — if the lookup
 * fails for any reason.
 */
export async function getProtectedOpportunityIds(db: Db): Promise<Set<string> | null> {
  const { data, error } = await db
    .from('application_tracker')
    .select('opportunity_id, status')
    .in('status', PROTECTED_TRACKER_STAGES as unknown as string[])
    .range(0, 9999)

  if (error) {
    console.error(
      '[Reconcile] Could not read application_tracker, so no deletion will run. ' +
        'Deleting without this list would erase students\' application history. Error:',
      error.message ?? error
    )
    return null
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row?.opportunity_id) ids.add(row.opportunity_id as string)
  }
  return ids
}

/**
 * Read every matching id, page by page.
 *
 * PostgREST caps an unbounded select at 1000 rows and gives no indication that
 * it truncated. A single-shot select here silently deleted only the first 1000
 * matches per run, so a backlog of 4,478 expired listings would have taken five
 * nights to clear — and any source with more than 1000 stale rows would never
 * fully reconcile.
 */
const PAGE = 1000

async function selectAllIds(
  build: (from: number, to: number) => QueryChain
): Promise<{ ids: string[]; error: QueryError | null }> {
  const ids: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { ids, error }
    const rows = data ?? []
    for (const r of rows) ids.push(String(r.id))
    if (rows.length < PAGE) break
  }
  return { ids, error: null }
}

/** Delete in chunks — a URL carrying hundreds of uuids exceeds PostgREST limits. */
async function deleteByIds(db: Db, ids: string[], chunkSize = 50): Promise<number> {
  let removed = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize)
    const { error, count } = await db
      .from('opportunities')
      .delete({ count: 'exact' })
      .in('id', slice)
    if (error) {
      console.error('[Reconcile] Delete chunk failed:', error.message ?? error)
      continue
    }
    removed += count ?? slice.length
  }
  return removed
}

async function markExpired(db: Db, ids: string[], now: string, chunkSize = 50): Promise<number> {
  let marked = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize)
    const { error } = await db
      .from('opportunities')
      .update({ status: 'Expired', updated_at: now })
      .in('id', slice)
    if (!error) marked += slice.length
  }
  return marked
}

/**
 * Delete every opportunity whose deadline has passed, preserving those a
 * student has already applied to.
 */
export async function deleteExpiredOpportunities(db: Db, now = new Date().toISOString()): Promise<ReconcileResult> {
  const protectedIds = await getProtectedOpportunityIds(db)
  if (protectedIds === null) {
    return {
      deleted: 0,
      preserved: 0,
      skipped: true,
      reason: 'could not read application_tracker; refusing to delete',
    }
  }

  const { ids: all, error } = await selectAllIds((from, to) =>
    db.from('opportunities')
      .select('id')
      .not('deadline', 'is', null)
      .lt('deadline', now)
      .range(from, to)
  )

  if (error) {
    return { deleted: 0, preserved: 0, skipped: true, reason: `select failed: ${error.message ?? error}` }
  }

  const toDelete = all.filter((id) => !protectedIds.has(id))
  const toKeep = all.filter((id) => protectedIds.has(id))

  const deleted = await deleteByIds(db, toDelete)
  const preserved = await markExpired(db, toKeep, now)

  return {
    deleted,
    preserved,
    skipped: false,
    reason: `${deleted} past-deadline listings deleted; ${preserved} kept because a student has applied to them`,
  }
}

/**
 * Delete listings from one source that a completed run did not observe —
 * i.e. the source no longer advertises them.
 *
 * `seenCount` is how many records this run processed for the source, and
 * `previousCount` how many that source had before it. If the run saw far fewer
 * than last time, it probably failed partway, so we skip rather than delete a
 * source's entire catalogue.
 */
export async function reconcileUnseen(
  db: Db,
  source: string,
  runStartedAt: string,
  seenCount: number,
  previousCount: number
): Promise<ReconcileResult> {
  if (previousCount > 0) {
    const coverage = seenCount / previousCount
    if (coverage < RECONCILE_MIN_COVERAGE) {
      const reason =
        `run saw ${seenCount} of a previous ${previousCount} (${Math.round(coverage * 100)}%), ` +
        `below the ${Math.round(RECONCILE_MIN_COVERAGE * 100)}% threshold — treating as a partial ` +
        `scrape and skipping deletion for "${source}"`
      console.warn(`[Reconcile] ${reason}`)
      return { deleted: 0, preserved: 0, skipped: true, reason }
    }
  }

  const protectedIds = await getProtectedOpportunityIds(db)
  if (protectedIds === null) {
    return {
      deleted: 0,
      preserved: 0,
      skipped: true,
      reason: 'could not read application_tracker; refusing to delete',
    }
  }

  const { ids: stale, error } = await selectAllIds((from, to) =>
    db.from('opportunities')
      .select('id')
      .eq('source', source)
      .or(`last_seen_at.is.null,last_seen_at.lt.${runStartedAt}`)
      .range(from, to)
  )

  if (error) {
    return { deleted: 0, preserved: 0, skipped: true, reason: `select failed: ${error.message ?? error}` }
  }

  const toDelete = stale.filter((id) => !protectedIds.has(id))
  const toKeep = stale.filter((id) => protectedIds.has(id))

  const deleted = await deleteByIds(db, toDelete)
  const preserved = await markExpired(db, toKeep, runStartedAt)

  return {
    deleted,
    preserved,
    skipped: false,
    reason: `${deleted} listings no longer advertised by "${source}" deleted; ${preserved} kept for applied students`,
  }
}
