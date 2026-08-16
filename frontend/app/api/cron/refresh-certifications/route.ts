import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'
import { collectCertifications } from '@/lib/certifications/ingest'
import { upsertCertifications } from '@/lib/certifications/upsert'

/**
 * GET /api/cron/refresh-certifications
 *
 * Weekly refresh of the certifications catalogue (Coursera, Microsoft Learn,
 * freeCodeCamp, Simplilearn, edX, Alison, Udacity, W3Schools, Cisco
 * Networking Academy, Udemy, DataCamp). Unlike the opportunities crons there is no
 * reconciliation/deletion step afterwards — see lib/certifications/ingest.ts
 * for why courses are never expired on a schedule.
 *
 * collectCertifications()'s defaults (22,000 Coursera courses — just under
 * its real ~23,409-course catalogue — 800 each of Simplilearn/edX) are kept
 * below each catalogue's true size to stay inside Vercel's cron duration
 * ceiling — a live run at 12,000 Coursera took ~132s; the Coursera leg is
 * bulk paginated JSON (no per-course fetch), so raising the cap mainly adds
 * more 100-row pages rather than materially more time. 22,000 courses
 * extrapolates to ~240s, hence the bumped maxDuration below.
 */
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = denyIfNotCron(request)
  if (denied) return denied

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const records = await collectCertifications()
    const { upserted, errors } = await upsertCertifications(supabase, records)

    return NextResponse.json({ success: true, fetched: records.length, upserted, errors })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Cron/refresh-certifications] failed:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
