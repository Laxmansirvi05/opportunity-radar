import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/cron/sweep-interviews — marks stale in-progress interview sessions
 * as abandoned.
 *
 * Mirrors the ai_search_jobs pattern: any session stuck in `in_progress` for
 * longer than STALE_THRESHOLD_MINUTES is almost certainly a disconnected
 * browser or a crashed agent. Marking it `abandoned` lets the student see
 * an honest status instead of `in_progress` forever.
 *
 * Protected by CRON_SECRET — Vercel Cron Jobs (or any external scheduler)
 * must send this header. Without it the route 401s.
 *
 * Wire this up in vercel.json as a cron with schedule "every 15 minutes".
 */

const STALE_THRESHOLD_MINUTES = 30

export async function POST(req: NextRequest) {
  // Vercel Cron protection — same pattern used by sweep-jobs
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
