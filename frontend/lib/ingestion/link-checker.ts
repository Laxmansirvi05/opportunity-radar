/**
 * Link-verification sweep (DATA-03).
 *
 * `link_status` / `link_checked_at` have existed on `opportunities` since the
 * trust-engine migration but nothing ever populated them — every one of the
 * 4,175 live rows had `link_status = NULL`.
 *
 * Scope, deliberately narrow: this checks the raw HTTP outcome of `apply_url`
 * and records it. It does NOT try to detect "looks like a generic careers
 * page" the way DATA-01's manual review did — that needed a human clicking
 * through and reading the rendered page per company, because the same HTTP
 * 200 meant "real job" for Databricks and "dead end" for Stripe. A status
 * code can't tell those apart. So auto-expiry here is restricted to signals
 * that are unambiguous regardless of the page's content: the URL doesn't
 * resolve at all, or the host itself says the resource is gone (404/410).
 * Everything else (2xx, redirects, 401/403/405/5xx) is recorded but left for
 * a human or a future, page-content-aware pass — a 403 is as likely to be
 * anti-bot blocking as a dead link, and treating it as dead would repeat the
 * exact mistake the audit already made once with Amazon's analytics JS.
 */

export interface CheckResult {
  /** HTTP status of the final response. 0 = DNS/connect/timeout failure. */
  status: number
}

export type LinkVerdict = 'ok' | 'dead'

const UNAMBIGUOUSLY_DEAD = new Set([0, 404, 410])

export function classifyLinkStatus(status: number): LinkVerdict {
  return UNAMBIGUOUSLY_DEAD.has(status) ? 'dead' : 'ok'
}

/**
 * Checks one URL. Never throws — every failure mode collapses to `status: 0`
 * so a batch of thousands never stalls on one bad host.
 */
export async function checkUrl(url: string, timeoutMs = 10_000): Promise<CheckResult> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  }

  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers })
    // Some hosts don't implement HEAD correctly (405/501) or return a
    // placeholder for it; a real GET is the only way to know for those.
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers })
      return { status: getRes.status }
    }
    return { status: res.status }
  } catch {
    try {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers })
      return { status: getRes.status }
    } catch {
      return { status: 0 }
    }
  }
}

// ── Batch sweep ──────────────────────────────────────────────────────────

/** Loosely typed for the same reason as lib/ingestion/reconciliation.ts's Db:
 *  the query builder is chainable/thenable and pinning a supabase-js version
 *  here would be unnecessary coupling. */
export interface QueryError {
  message?: string
}
export interface QueryResult {
  data: Record<string, unknown>[] | null
  error: QueryError | null
}
export interface QueryChain {
  select: (cols?: string) => QueryChain
  update: (payload: Record<string, unknown>) => QueryChain
  eq: (col: string, val: unknown) => QueryChain
  in: (col: string, vals: readonly unknown[]) => QueryChain
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => QueryChain
  limit: (n: number) => QueryChain
  then: (resolve: (value: QueryResult) => void) => void
}
export interface Db {
  from: (table: string) => QueryChain
}

export interface SweepOptions {
  /** Max rows to pull for this invocation. */
  limit?: number
  /** URLs in flight at once. */
  concurrency?: number
  /** Per-request timeout. */
  timeoutMs?: number
  /** Stop starting new work once this much wall time has elapsed, so a
   *  serverless invocation always returns before its own hard deadline. */
  timeBudgetMs?: number
  now?: () => number
}

export interface SweepResult {
  checked: number
  ok: number
  dead: number
  expired: number
  elapsedMs: number
}

const CHUNK = 50

async function updateChunked(
  db: Db,
  rows: { id: string; status: number; checkedAt: string }[],
  chunkSize = CHUNK
): Promise<void> {
  // link_status/link_checked_at differ per row, so this can't be a single
  // bulk UPDATE — chunked one-call-per-row would be 4,000+ round trips, so
  // instead each row gets its own targeted .eq('id', ...).update(...), issued
  // CHUNK at a time to bound in-flight requests.
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize)
    await Promise.all(
      slice.map((r) =>
        db.from('opportunities').update({ link_status: r.status, link_checked_at: r.checkedAt }).eq('id', r.id)
      )
    )
  }
}

async function expireChunked(db: Db, ids: string[], now: string, chunkSize = CHUNK): Promise<void> {
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize)
    await db.from('opportunities').update({ status: 'Expired', updated_at: now }).in('id', slice)
  }
}

/**
 * Runs one bounded pass of the sweep: the least-recently-checked live rows
 * first (`link_checked_at NULLS FIRST`), so repeated invocations eventually
 * cover the whole catalogue and self-correct if any one run is cut short.
 */
export async function sweepLinkHealth(db: Db, options: SweepOptions = {}): Promise<SweepResult> {
  const limit = options.limit ?? 4200
  const concurrency = options.concurrency ?? 25
  const timeoutMs = options.timeoutMs ?? 10_000
  const timeBudgetMs = options.timeBudgetMs ?? 270_000
  const now = options.now ?? (() => Date.now())
  const startedAt = now()

  const { data, error } = await db
    .from('opportunities')
    .select('id, apply_url')
    .in('status', ['Published', 'Closing Soon'])
    .order('link_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error || !data) {
    return { checked: 0, ok: 0, dead: 0, expired: 0, elapsedMs: now() - startedAt }
  }

  const rows = data as { id: string; apply_url: string }[]

  const result: SweepResult = { checked: 0, ok: 0, dead: 0, expired: 0, elapsedMs: 0 }
  const toWrite: { id: string; status: number; checkedAt: string }[] = []
  const deadIds: string[] = []

  for (let i = 0; i < rows.length; i += concurrency) {
    if (now() - startedAt > timeBudgetMs) break

    const batch = rows.slice(i, i + concurrency)
    const outcomes = await Promise.all(
      batch.map(async (row) => ({ row, check: await checkUrl(row.apply_url, timeoutMs) }))
    )

    const checkedAt = new Date().toISOString()
    for (const { row, check } of outcomes) {
      result.checked++
      toWrite.push({ id: row.id, status: check.status, checkedAt })
      if (classifyLinkStatus(check.status) === 'dead') {
        result.dead++
        deadIds.push(row.id)
      } else {
        result.ok++
      }
    }
  }

  await updateChunked(db, toWrite)
  if (deadIds.length > 0) {
    await expireChunked(db, deadIds, new Date().toISOString())
    result.expired = deadIds.length
  }

  result.elapsedMs = now() - startedAt
  return result
}

// ── Certifications sweep ────────────────────────────────────────────────

async function updateChunkedCertifications(
  db: Db,
  rows: { id: string; status: number; checkedAt: string }[],
  chunkSize = CHUNK
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize)
    await Promise.all(
      slice.map((r) =>
        db.from('certifications').update({ link_status: r.status, link_checked_at: r.checkedAt }).eq('id', r.id)
      )
    )
  }
}

/**
 * Same HTTP-verification logic as {@link sweepLinkHealth}, aimed at
 * `certifications.url` instead of `opportunities.apply_url`. Deliberately
 * has no expire/delete step — certifications are never removed on a
 * schedule (see ingest.ts's header comment on why). A dead result is just
 * recorded on the row via `link_status`; get-catalogue.ts filters
 * unambiguously-dead, already-checked rows out of what students see, but
 * the row itself is left in place for a human to review or for the next
 * refresh to correct if the course comes back.
 */
export async function sweepCertificationLinks(db: Db, options: SweepOptions = {}): Promise<SweepResult> {
  const limit = options.limit ?? 4200
  const concurrency = options.concurrency ?? 25
  const timeoutMs = options.timeoutMs ?? 10_000
  const timeBudgetMs = options.timeBudgetMs ?? 270_000
  const now = options.now ?? (() => Date.now())
  const startedAt = now()

  const { data, error } = await db
    .from('certifications')
    .select('id, url')
    .order('link_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error || !data) {
    return { checked: 0, ok: 0, dead: 0, expired: 0, elapsedMs: now() - startedAt }
  }

  const rows = data as { id: string; url: string }[]

  const result: SweepResult = { checked: 0, ok: 0, dead: 0, expired: 0, elapsedMs: 0 }
  const toWrite: { id: string; status: number; checkedAt: string }[] = []

  for (let i = 0; i < rows.length; i += concurrency) {
    if (now() - startedAt > timeBudgetMs) break

    const batch = rows.slice(i, i + concurrency)
    const outcomes = await Promise.all(
      batch.map(async (row) => ({ row, check: await checkUrl(row.url, timeoutMs) }))
    )

    const checkedAt = new Date().toISOString()
    for (const { row, check } of outcomes) {
      result.checked++
      toWrite.push({ id: row.id, status: check.status, checkedAt })
      if (classifyLinkStatus(check.status) === 'dead') result.dead++
      else result.ok++
    }
  }

  await updateChunkedCertifications(db, toWrite)
  result.elapsedMs = now() - startedAt
  return result
}
