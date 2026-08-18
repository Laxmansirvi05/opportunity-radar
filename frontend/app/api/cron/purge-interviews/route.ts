import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/cron/purge-interviews — enforces the 30-day retention policy on
 * interview data.
 *
 * Voice recordings and transcripts are more sensitive than a resume (see the
 * migration comment on interview_sessions). This cron deletes sessions older
 * than RETENTION_DAYS and their cascade-linked reports.
 *
 * Protected by CRON_SECRET, same as sweep-interviews.
 */

const RETENTION_DAYS = 30

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
