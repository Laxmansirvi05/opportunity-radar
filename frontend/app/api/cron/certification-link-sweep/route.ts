import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';
import { sweepCertificationLinks, type Db } from '@/lib/ingestion/link-checker';

/**
 * GET /api/cron/certification-link-sweep
 *
 * Certifications' `link_status`/`link_checked_at` columns have existed since
 * the table's own migration but nothing populates them yet. This checks the
 * real HTTP outcome of `url` for the least-recently-checked rows first, so
 * repeated runs cover the whole catalogue. Unlike the opportunities sweep,
 * dead links are recorded but not auto-deleted — see
 * lib/ingestion/link-checker.ts for why; get-catalogue.ts is what actually
 * keeps confirmed-dead rows out of what students see.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = denyIfNotCron(request);
  if (denied) return denied;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase admin credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await sweepCertificationLinks(supabase as unknown as Db, {
      timeBudgetMs: 270_000, // leave a margin under the 300s function ceiling
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Cron/certification-link-sweep] failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
