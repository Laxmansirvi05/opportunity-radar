import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';
import { sweepLinkHealth, type Db } from '@/lib/ingestion/link-checker';

/**
 * GET /api/cron/link-sweep
 *
 * DATA-03: `link_status`/`link_checked_at` have existed since the trust-engine
 * migration but nothing ever populated them. This checks the real HTTP outcome
 * of `apply_url` for the least-recently-checked live rows first, so repeated
 * runs cover the whole catalogue and self-correct if any one run is cut short.
 *
 * A 300s budget covers roughly 4,000 rows at the concurrency used here — see
 * lib/ingestion/link-checker.ts for why. A truncated run is safe: everything
 * checked so far is written before the function returns, and only unambiguous
 * failures (DNS/connect failure, 404, 410) get auto-expired — see that file
 * for why the bar is that narrow.
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

    const result = await sweepLinkHealth(supabase as unknown as Db, {
      timeBudgetMs: 270_000, // leave a margin under the 300s function ceiling
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Cron/link-sweep] failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
