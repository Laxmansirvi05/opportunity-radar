import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'
import { collectCertifications } from '@/lib/certifications/ingest'
import { upsertCertifications } from '@/lib/certifications/upsert'

/**
 * GET /api/cron/refresh-certifications
 *
 * Weekly refresh of the certifications catalogue: Coursera (technical
 * topics only — see TECHNICAL_TOPICS in ingest.ts), Microsoft Learn
 * (certifications, learning paths, and individual modules — three separate
 * catalog types), freeCodeCamp, Simplilearn, edX, Alison, Udacity,
 * W3Schools, Cisco Networking Academy, Udemy, DataCamp, IBM SkillsBuild,
 * Oracle University, AWS Skill Builder, Forage, and Google Skills. Unlike
 * the opportunities crons there is no reconciliation/deletion step
 * afterwards — see lib/certifications/ingest.ts for why courses are never
 * expired on a schedule.
 *
 * Every leg in collectCertifications() runs inside one Promise.all, so
 * total wall-clock time is bounded by the single slowest leg, not their
 * sum — currently Coursera (~115s at its 22,000 cap, which sits just under
 * its real ~19,300-course English-filtered ceiling) and Google Skills
 * (~120s at gentle concurrency, deliberately slow to avoid the rate-limit
 * that a faster burst briefly triggered during development) are the two
 * closest to each other and to this ceiling; every other leg finishes
 * well inside that window.
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
