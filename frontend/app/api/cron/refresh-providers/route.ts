import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';

/**
 * GET /api/cron/refresh-providers
 *
 * Refreshes the direct-employer sources.
 *
 * This route previously ran WellfoundProvider, which did not scrape anything —
 * it returned two hardcoded listings pointing at wellfound.com/jobs/201 and /202,
 * both of which 404. That provider has been deleted.
 *
 * It now runs the two real, unscheduled providers we already had:
 *   - AmazonProvider — amazon.jobs search API, filtered to country=IND
 *   - YCProvider     — Hacker News official jobs API (YC portfolio companies)
 */
export async function GET(request: Request) {
  const denied = denyIfNotCron(request);
  if (denied) return denied;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase admin credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { OpportunityIngestionService, isPipelineDisabled } = await import('@/src/providers/opportunities/ingestion/OpportunityIngestionService');
    const { AmazonProvider } = await import('@/src/providers/opportunities/providers/AmazonProvider');
    const { YCProvider } = await import('@/src/providers/opportunities/providers/YCProvider');

    const providers = [
      new AmazonProvider(),
      new YCProvider(),
    ];

    const ingestionService = new OpportunityIngestionService(providers, supabase);
    const stats = await ingestionService.runPipeline();

    // A disabled pipeline is a misconfiguration, not a successful run. Return a
    // non-2xx so Vercel surfaces it as a failed cron instead of silently
    // reporting success while nothing is being ingested.
    if (isPipelineDisabled(stats)) {
      return NextResponse.json(
        { success: false, error: stats.reason, stats },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, stats }, { status: 200 });
  } catch (error: any) {
    console.error('Cron job failed to initialize:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
