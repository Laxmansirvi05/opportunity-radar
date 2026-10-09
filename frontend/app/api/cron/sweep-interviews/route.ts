import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'

/**
 * GET /api/cron/sweep-interviews — marks stale in-progress interview sessions
 * as abandoned.
 *
 * Any session stuck in `in_progress` for longer than STALE_THRESHOLD_MINUTES is
 * almost certainly a disconnected browser or a crashed agent. Marking it
 * `abandoned` lets the student see an honest status instead of `in_progress`
 * forever.
 *
 * This exported POST, not GET. Vercel Cron invokes with GET, so the scheduled
 * job in vercel.json had been hitting a 405 since the day it was added and no
 * session had ever been swept in production.
 *
 * Authorised by the shared denyIfNotCron guard, which fails closed. The check
 * here used to be `if (cronSecret && header !== ...)`, and that `cronSecret &&`
 * meant an unset CRON_SECRET skipped authorisation altogether — leaving an
 * unauthenticated request able to mass-update sessions to `abandoned` with the
 * service-role key.
 *
 * Scheduled daily in vercel.json. It is NOT every 15 minutes, whatever the
 * comment here used to say: the Hobby plan allows once-daily crons only, and a
 * fifteen-minute schedule in vercel.json fails the build.
 */

const STALE_THRESHOLD_MINUTES = 30

// The update is one round trip, but the preceding scan grows with the table.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  // Service-role client — this is a system operation, not user-scoped.
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60_000).toISOString()

  // Find sessions that have been in_progress for too long.
  // The idx_interview_sessions_status_started index was created specifically
  // for this query — see the migration's comments.
  const { data: staleSessions, error: findError } = await supabase
    .from('interview_sessions')
    .select('id, started_at')
    .eq('status', 'in_progress')
    .lt('started_at', cutoff)

  if (findError) {
    console.error('[sweep-interviews] find error:', findError.message)
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }

  if (!staleSessions?.length) {
    return NextResponse.json({ swept: 0 })
  }

  const ids = staleSessions.map((s) => s.id)
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('interview_sessions')
    .update({ status: 'abandoned', ended_at: now })
    .in('id', ids)

  if (updateError) {
    console.error('[sweep-interviews] update error:', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[sweep-interviews] Marked ${ids.length} stale session(s) as abandoned`)
  return NextResponse.json({ swept: ids.length, ids })
}
