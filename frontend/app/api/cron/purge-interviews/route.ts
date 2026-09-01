import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'

/**
 * GET /api/cron/purge-interviews — enforces the 30-day retention policy on
 * interview data.
 *
 * Voice recordings and transcripts are more sensitive than a resume (see the
 * migration comment on interview_sessions). This cron deletes sessions older
 * than RETENTION_DAYS and their cascade-linked reports.
 *
 * This exported GET, not POST. Vercel Cron invokes with GET, so the scheduled
 * job in vercel.json had been hitting a 405 since the day it was added and the
 * retention policy had never actually run against production data.
 *
 * Authorised by the shared denyIfNotCron guard, which fails closed. The check
 * here used to be `if (cronSecret && header !== ...)`, and that `cronSecret &&`
 * meant an unset CRON_SECRET skipped authorisation altogether — leaving an
 * unauthenticated request able to trigger a service-role hard delete of every
 * interview session past the cutoff.
 */

const RETENTION_DAYS = 30

// The delete is one round trip, but the preceding scan is unbounded and grows
// with the table.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000).toISOString()

  // Delete sessions older than the retention window. interview_reports has
  // ON DELETE CASCADE on session_id, so reports are cleaned up automatically.
  const { data: expired, error: findError } = await supabase
    .from('interview_sessions')
    .select('id')
    .lt('created_at', cutoff)

  if (findError) {
    console.error('[purge-interviews] find error:', findError.message)
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }

  if (!expired?.length) {
    return NextResponse.json({ purged: 0 })
  }

  const ids = expired.map((s) => s.id)

  const { error: deleteError } = await supabase
    .from('interview_sessions')
    .delete()
    .in('id', ids)

  if (deleteError) {
    console.error('[purge-interviews] delete error:', deleteError.message)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  console.log(`[purge-interviews] Purged ${ids.length} session(s) older than ${RETENTION_DAYS} days`)
  return NextResponse.json({ purged: ids.length })
}
