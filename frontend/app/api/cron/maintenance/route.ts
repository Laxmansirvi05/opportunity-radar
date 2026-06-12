import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/cron/maintenance
 *
 * Standalone maintenance endpoint for the Opportunity Radar ingestion system.
 * Intended to run on an independent schedule (e.g., daily at 02:00 UTC) via Vercel Cron.
 *
 * Steps executed:
 *   1. Deadline expiration  — marks stale records as Expired.
 *   2. Freshness verification — probes apply_url for 404/410 and expires dead links.
 *   3. Logging              — writes execution metrics to `ingestion_logs`.
 *
 * Authorization: Bearer token matching the CRON_SECRET environment variable.
 */
export async function GET(request: Request) {
  // ── Security ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // ── Supabase client (service-role bypasses RLS) ────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase admin credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Dynamically import the Maintenance service ────────────────────────
    // Dynamic import prevents Turbopack from bundling scraping deps into the dev server.
    const { MaintenanceService } = await import(
      '@/src/providers/opportunities/ingestion/MaintenanceService'
    );

    const maintenance = new MaintenanceService(supabase);
    const result = await maintenance.run();

    return NextResponse.json({ success: true, result }, { status: 200 });

  } catch (error: any) {
    console.error('[Maintenance] Cron endpoint failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
