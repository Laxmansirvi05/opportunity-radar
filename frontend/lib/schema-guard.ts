import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Startup verification that the deployed database matches what the code expects.
 *
 * This exists because of a real outage class, not a hypothetical one. On
 * 2026-08-10 an audit found four tables missing from production and two more
 * that the service role could not read. Three features were dead and the
 * nightly deadline-alert cron had been returning 500 every night since it
 * shipped. Nothing detected any of it, because a missing table only surfaces
 * as a 500 on the one code path that touches it — and nobody was on that path.
 *
 * Two lessons are encoded here.
 *
 * 1. EXISTENCE IS NOT ENOUGH. `notifications` existed the whole time; the
 *    service role simply had no GRANT on it. A check that only asks "is this
 *    table present?" would have passed while the cron stayed broken. So this
 *    probes reachability *as the role that actually uses the table*.
 *
 * 2. `head: true` COUNT QUERIES CANNOT PROVE EXISTENCE. PostgREST returns
 *    `count: null` with **no error** for a table that does not exist, so a
 *    head-count probe reports a missing table as fine. Every check below issues
 *    a real row select and reads the error code. This is not a style
 *    preference — a head-count probe gave a false all-clear during the audit
 *    itself and had to be re-run.
 */

export type CheckStatus = 'ok' | 'missing' | 'denied' | 'error'

export interface SchemaCheck {
  /** Object name, e.g. `notifications` or `resume-toolkit`. */
  name: string
  kind: 'table' | 'bucket' | 'rpc'
  status: CheckStatus
  /** What breaks when this is not reachable. Written for whoever reads the log. */
  breaks: string
  detail?: string
}

export interface SchemaReport {
  healthy: boolean
  checkedAt: string
  failures: SchemaCheck[]
  checks: SchemaCheck[]
}

/**
 * Tables the server must be able to reach with the service-role key.
 *
 * `breaks` is deliberately concrete. "profiles is unreachable" tells you
 * nothing at 3am; "the protected layout cannot load the user's avatar or name"
 * tells you what a student sees.
 */
const REQUIRED_TABLES: { name: string; breaks: string }[] = [
  { name: 'opportunities',        breaks: 'Search and the dashboard return nothing' },
  { name: 'companies',            breaks: 'Opportunity cards lose their company name and logo' },
  { name: 'opportunity_tags',     breaks: 'Tag filters in search stop matching' },
  { name: 'application_tracker',  breaks: 'The tracker board cannot load or move applications' },
  { name: 'bookmarks',            breaks: 'Saving an opportunity fails' },
  { name: 'profiles',             breaks: 'The protected layout cannot load the user name or avatar' },
  { name: 'notifications',        breaks: 'The nightly deadline-alert cron returns 500 and no alerts are ever created' },
  { name: 'recently_viewed',      breaks: 'Recently-viewed history stops recording' },
  { name: 'resumes',              breaks: 'The resume builder and every resume list are empty' },
  { name: 'resume_ats_reports',   breaks: 'ATS results cannot be saved, so a score is lost on reload' },
  { name: 'resume_optimizations', breaks: 'Resume optimisation cannot persist a run, so the checklist resets on logout' },
  { name: 'certifications',       breaks: 'The certifications page renders empty' },
  { name: 'ai_search_jobs',       breaks: 'AI Search accepts an upload then 500s, losing the run' },
  { name: 'chat_conversations',   breaks: 'The AI assistant cannot start or resume a conversation' },
  { name: 'chat_messages',        breaks: 'The AI assistant loses every message' },
  { name: 'ai_usage_log',         breaks: 'AI usage and cost go unrecorded' },
  { name: 'ingestion_logs',       breaks: 'Ingestion runs become unobservable and /api/cron/health degrades' },
  { name: 'source_registry',      breaks: 'The employer-board provider has no sources to crawl' },
  { name: 'hub_messages',         breaks: 'The Hub community chat fails to load or accept messages' },
  { name: 'notes',                breaks: 'The Notes page and the floating robot’s quick-note composer both fail to save anything' },
  { name: 'note_folders',         breaks: 'The Notes sidebar 500s on load, so no note can be filed or filtered' },
  { name: 'interview_sessions',   breaks: 'Starting a mock interview 500s before a room is ever created' },
  { name: 'interview_reports',    breaks: 'A completed interview’s scorecard cannot be saved, so the report is lost' },
]

const REQUIRED_BUCKETS: { name: string; breaks: string }[] = [
  { name: 'resumes',         breaks: 'Resume PDF upload fails' },
  { name: 'avatars',         breaks: 'Profile picture upload fails' },
  { name: 'resume-toolkit',  breaks: 'Resume-builder photo upload returns 500 on every attempt' },
  { name: 'company-logos',   breaks: 'Company logos fall back to a placeholder' },
  { name: 'hub-attachments', breaks: 'Sending an image in the Hub fails' },
  { name: 'note-attachments', breaks: 'Pasting a screenshot or inserting an image into a note fails' },
]

const REQUIRED_RPCS: { name: string; args: Record<string, unknown>; breaks: string }[] = [
  {
    name: 'search_opportunities_rpc',
    args: {
      search_query: null, filter_category: null, filter_mode: null, filter_is_paid: null,
      filter_location: null, filter_freshness_interval: null, filter_deadline_min: null,
      filter_deadline_max: null, sort_by: 'relevance', page_offset: 0, page_limit: 1,
    },
    breaks: 'Search silently falls back to the slower OR-based query path',
  },
  {
    name: 'check_ai_rate_limit',
    args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_feature: '__schema_guard__', p_max: 1, p_window_ms: 1000 },
    breaks: 'AI rate limiting loses its database backstop and falls back to per-instance memory',
  },
]

/** PostgREST error codes we can interpret precisely. */
const CODE_TABLE_MISSING = 'PGRST205'
const CODE_RPC_MISSING = 'PGRST202'
const CODE_PERMISSION_DENIED = '42501'

async function checkTable(db: SupabaseClient, name: string, breaks: string): Promise<SchemaCheck> {
  // A real row select — see the head:true note in the module docblock.
  const { error } = await db.from(name).select('*').limit(1)

  if (!error) return { name, kind: 'table', status: 'ok', breaks }
  if (error.code === CODE_TABLE_MISSING) {
    return { name, kind: 'table', status: 'missing', breaks, detail: 'table not present in the PostgREST schema' }
  }
  if (error.code === CODE_PERMISSION_DENIED) {
    return { name, kind: 'table', status: 'denied', breaks, detail: 'table exists but service_role has no GRANT on it' }
  }
  return { name, kind: 'table', status: 'error', breaks, detail: `${error.code ?? '?'}: ${error.message}` }
}

async function checkBucket(db: SupabaseClient, present: Set<string>, name: string, breaks: string): Promise<SchemaCheck> {
  return present.has(name)
    ? { name, kind: 'bucket', status: 'ok', breaks }
    : { name, kind: 'bucket', status: 'missing', breaks, detail: 'storage bucket does not exist' }
}

async function checkRpc(db: SupabaseClient, name: string, args: Record<string, unknown>, breaks: string): Promise<SchemaCheck> {
  const { error } = await db.rpc(name, args)

  // Only absence matters. An argument or constraint complaint still proves the
  // function is there, which is all this check is asserting.
  if (error?.code === CODE_RPC_MISSING) {
    return { name, kind: 'rpc', status: 'missing', breaks, detail: 'function does not exist' }
  }
  return { name, kind: 'rpc', status: 'ok', breaks }
}

/**
 * Probe every required object. Never throws — a guard that crashes the thing it
 * is guarding is worse than the drift it was meant to catch.
 */
export async function verifySchema(db: SupabaseClient): Promise<SchemaReport> {
  const checks: SchemaCheck[] = []

  const tableChecks = await Promise.all(
    REQUIRED_TABLES.map(({ name, breaks }) => checkTable(db, name, breaks))
  )
  checks.push(...tableChecks)

  const { data: buckets, error: bucketError } = await db.storage.listBuckets()
  if (bucketError) {
    checks.push({
      name: 'storage', kind: 'bucket', status: 'error',
      breaks: 'Every file upload path is unverified',
      detail: bucketError.message,
    })
  } else {
    const present = new Set((buckets ?? []).map((b) => b.name))
    checks.push(...await Promise.all(
      REQUIRED_BUCKETS.map(({ name, breaks }) => checkBucket(db, present, name, breaks))
    ))
  }

  checks.push(...await Promise.all(
    REQUIRED_RPCS.map(({ name, args, breaks }) => checkRpc(db, name, args, breaks))
  ))

  const failures = checks.filter((c) => c.status !== 'ok')
  return {
    healthy: failures.length === 0,
    checkedAt: new Date().toISOString(),
    failures,
    checks,
  }
}

/**
 * Render a report for a server log. Loud on purpose: this is the signal that
 * was missing when four tables went absent from production unnoticed.
 */
export function formatReport(report: SchemaReport): string {
  if (report.healthy) {
    return `[SchemaGuard] OK — all ${report.checks.length} required database objects reachable.`
  }

  const lines = [
    '',
    '════════════════════════════════════════════════════════════════════',
    `[SchemaGuard] ${report.failures.length} REQUIRED DATABASE OBJECT(S) UNREACHABLE`,
    '════════════════════════════════════════════════════════════════════',
  ]
  for (const f of report.failures) {
    lines.push(`  ${f.status.toUpperCase().padEnd(8)} ${f.kind.padEnd(7)} ${f.name}`)
    lines.push(`           ${f.detail ?? ''}`)
    lines.push(`           → ${f.breaks}`)
  }
  lines.push('')
  lines.push('  Apply the matching migration in supabase/migrations, then restart.')
  lines.push('  Do NOT run a blanket `supabase db push`: several older migrations')
  lines.push('  contain bulk INSERTs and will duplicate catalogue data. Apply the')
  lines.push('  specific migration individually and verify it landed.')
  lines.push('════════════════════════════════════════════════════════════════════')
  lines.push('')
  return lines.join('\n')
}
