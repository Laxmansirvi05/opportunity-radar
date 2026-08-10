/**
 * Server startup hooks.
 *
 * Currently: verify the deployed database matches what the code expects.
 *
 * Scope is deliberately development-only. Next.js awaits `register()` before
 * the server accepts requests, so probing ~24 database objects here would add
 * that round-trip cost to every serverless cold start in production for no
 * benefit — production has the same check on /api/cron/health, which runs
 * daily and can be hit on demand.
 *
 * In development it is fire-and-forget: the report appears a second after boot
 * without delaying the dev server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV === 'production') return

  // Imported lazily so the Supabase client is never pulled into the edge
  // runtime bundle, and so a missing key cannot break startup.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[SchemaGuard] skipped — Supabase credentials are not set in this environment.')
    return
  }

  void (async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const { verifySchema, formatReport } = await import('@/lib/schema-guard')

      const db = createClient(url, key, { auth: { persistSession: false } })
      const report = await verifySchema(db)

      // Failures go to stderr so they stand out in a busy dev log.
      if (report.healthy) console.log(formatReport(report))
      else console.error(formatReport(report))
    } catch (err) {
      // A guard that breaks the server it guards is worse than the drift.
      console.warn('[SchemaGuard] check could not run:', err instanceof Error ? err.message : String(err))
    }
  })()
}
