import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'
import { collectCertifications } from '@/lib/certifications/ingest'
import { upsertCertifications } from '@/lib/certifications/upsert'

/**
 * GET /api/cron/refresh-certifications
 *
 * Weekly refresh of the certifications catalogue (Coursera, Microsoft Learn,
 * freeCodeCamp, Simplilearn). Unlike the opportunities crons there is no
 * reconciliation/deletion step afterwards — see lib/certifications/ingest.ts
 * for why courses are never expired on a schedule.
 *
 * maxCoursera is kept below the full catalogue (23k+ courses) to stay inside
 * Vercel's cron duration ceiling; raise it if the plan's limit allows more.
 */
export const maxDuration = 280

export async function GET(request: Request) {
  const denied = denyIfNotCron(request)
  if (denied) return denied

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const records = await collectCertifications(1500, 250)
    const { upserted, errors } = await upsertCertifications(supabase, records)

    return NextResponse.json({ success: true, fetched: records.length, upserted, errors })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Cron/refresh-certifications] failed:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
