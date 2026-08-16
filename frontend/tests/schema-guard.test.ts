import { describe, it, expect } from 'vitest'
import { verifySchema, formatReport, type SchemaReport } from '@/lib/schema-guard'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A stub Supabase client.
 *
 * `missing` / `denied` name objects that should fail, everything else succeeds.
 * The error codes are the real ones PostgREST returns, which is the whole point
 * of the guard: it distinguishes "not there" from "there but not readable".
 */
function stubClient(opts: {
  missingTables?: string[]
  deniedTables?: string[]
  buckets?: string[]
  missingRpcs?: string[]
  bucketListError?: string
} = {}): SupabaseClient {
  const missing = new Set(opts.missingTables ?? [])
  const denied = new Set(opts.deniedTables ?? [])
  const missingRpcs = new Set(opts.missingRpcs ?? [])
  const buckets = opts.buckets ?? ['resumes', 'avatars', 'resume-toolkit', 'company-logos', 'hub-attachments', 'note-attachments']

  return {
    from(table: string) {
      return {
        select() {
          return {
            limit: async () => {
              if (missing.has(table)) {
                return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } }
              }
              if (denied.has(table)) {
                return { data: null, error: { code: '42501', message: `permission denied for table ${table}` } }
              }
              return { data: [{}], error: null }
            },
          }
        },
      }
    },
    rpc: async (name: string) =>
      missingRpcs.has(name)
        ? { data: null, error: { code: 'PGRST202', message: 'function does not exist' } }
        : { data: [], error: null },
    storage: {
      listBuckets: async () =>
        opts.bucketListError
          ? { data: null, error: { message: opts.bucketListError } }
          : { data: buckets.map((name) => ({ name })), error: null },
    },
  } as unknown as SupabaseClient
}

describe('a correctly deployed database', () => {
  it('reports healthy with no failures', async () => {
    const report = await verifySchema(stubClient())
    expect(report.healthy).toBe(true)
    expect(report.failures).toHaveLength(0)
    expect(report.checks.length).toBeGreaterThan(20)
  })

  it('says so in one line, without shouting', async () => {
    const out = formatReport(await verifySchema(stubClient()))
    expect(out).toContain('OK')
    expect(out).not.toContain('UNREACHABLE')
  })
})

describe('the drift that actually happened on 2026-08-10', () => {
  it('catches the four tables that were missing from production', async () => {
    const report = await verifySchema(
      stubClient({ missingTables: ['certifications', 'ai_search_jobs', 'resume_optimizations', 'resume_ats_reports'] })
    )

    expect(report.healthy).toBe(false)
    expect(report.failures.map((f) => f.name).sort()).toEqual(
      ['ai_search_jobs', 'certifications', 'resume_ats_reports', 'resume_optimizations']
    )
    expect(report.failures.every((f) => f.status === 'missing')).toBe(true)
  })

  it('catches a table that EXISTS but the service role cannot read', async () => {
    // This is the notifications bug. The table was present the entire time; the
    // GRANT was never issued, and the nightly cron 500'd every night. A guard
    // that only asked "does this table exist?" would have passed.
    const report = await verifySchema(stubClient({ deniedTables: ['notifications'] }))

    expect(report.healthy).toBe(false)
    const n = report.failures.find((f) => f.name === 'notifications')
    expect(n?.status).toBe('denied')
    expect(n?.detail).toContain('no GRANT')
  })

  it('catches the missing resume-toolkit storage bucket', async () => {
    const report = await verifySchema(stubClient({ buckets: ['resumes', 'avatars', 'company-logos'] }))
    const b = report.failures.find((f) => f.name === 'resume-toolkit')
    expect(b?.status).toBe('missing')
    expect(b?.kind).toBe('bucket')
  })

  it('distinguishes missing from denied, because the fixes differ', async () => {
    // A missing table needs a migration; a denied one needs a GRANT. Collapsing
    // them into "broken" would send someone to the wrong fix.
    const report = await verifySchema(stubClient({ missingTables: ['certifications'], deniedTables: ['profiles'] }))
    const byName = Object.fromEntries(report.failures.map((f) => [f.name, f.status]))
    expect(byName['certifications']).toBe('missing')
    expect(byName['profiles']).toBe('denied')
  })
})

describe('RPC checks', () => {
  it('flags a genuinely absent function', async () => {
    const report = await verifySchema(stubClient({ missingRpcs: ['search_opportunities_rpc'] }))
    expect(report.failures.find((f) => f.name === 'search_opportunities_rpc')?.status).toBe('missing')
  })

  it('accepts a function that exists but rejects the probe arguments', async () => {
    // Any error other than PGRST202 still proves the function is there, which
    // is all this check asserts.
    const db = {
      ...stubClient(),
      rpc: async () => ({ data: null, error: { code: '22P02', message: 'invalid input syntax' } }),
    } as unknown as SupabaseClient

    const report = await verifySchema(db)
    expect(report.failures.filter((f) => f.kind === 'rpc')).toHaveLength(0)
  })
})

describe('the guard never makes things worse', () => {
  it('does not throw when storage is unreachable', async () => {
    const report = await verifySchema(stubClient({ bucketListError: 'network down' }))
    expect(report.healthy).toBe(false)
    expect(report.failures.some((f) => f.status === 'error')).toBe(true)
  })

  it('does not throw when every single check fails', async () => {
    const everything = ['opportunities', 'companies', 'opportunity_tags', 'application_tracker',
      'bookmarks', 'profiles', 'notifications', 'recently_viewed', 'resumes', 'resume_ats_reports',
      'resume_optimizations', 'certifications', 'ai_search_jobs', 'chat_conversations',
      'chat_messages', 'ai_usage_log', 'ingestion_logs', 'source_registry', 'hub_messages',
      'notes', 'note_folders', 'interview_sessions', 'interview_reports']
    const report = await verifySchema(stubClient({ missingTables: everything, buckets: [], missingRpcs: ['search_opportunities_rpc', 'check_ai_rate_limit'] }))
    expect(report.healthy).toBe(false)
    // 6 required buckets (resumes, avatars, resume-toolkit, company-logos, hub-attachments,
    // note-attachments) + 2 RPCs
    expect(report.failures.length).toBe(everything.length + 6 + 2)
  })
})

describe('the failure report is actionable', () => {
  let report: SchemaReport

  it('names what breaks, not just what is missing', async () => {
    report = await verifySchema(stubClient({ deniedTables: ['notifications'] }))
    const out = formatReport(report)

    expect(out).toContain('notifications')
    expect(out).toContain('nightly deadline-alert cron')
  })

  it('warns against the blanket db push that would duplicate the catalogue', async () => {
    const out = formatReport(await verifySchema(stubClient({ missingTables: ['certifications'] })))
    expect(out).toContain('Do NOT run a blanket')
    expect(out).toContain('bulk INSERT')
  })
})
