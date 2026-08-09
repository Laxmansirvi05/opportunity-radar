import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';

/**
 * GET /api/cron/refresh-employers
 *
 * Direct-from-employer refresh. Reads every active board in `source_registry`
 * and ingests postings straight from the company's own ATS, so the apply link
 * lands on the employer's domain rather than an aggregator.
 *
 * Note on duration: a full pass over ~17 boards takes roughly 300s, which sits
 * right at the Hobby ceiling. A truncated run is safe — records already
 * upserted persist, and reconciliation only runs after the loop completes, so a
 * partial pass can never delete anything. Moving this onto the queue services
 * removes the ceiling entirely and is the next planned step.
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

    const { OpportunityIngestionService, isPipelineDisabled } = await import(
      '@/src/providers/opportunities/ingestion/OpportunityIngestionService'
    );
    const { AtsBoardProvider } = await import(
      '@/src/providers/opportunities/providers/AtsBoardProvider'
    );
    type RegistryDb = ConstructorParameters<typeof AtsBoardProvider>[0];

    const ingestionService = new OpportunityIngestionService(
      // The real Supabase client is a structural superset of the narrow
      // registry contract the provider declares for testability.
      [new AtsBoardProvider(supabase as unknown as RegistryDb)],
      supabase
    );
    const stats = await ingestionService.runPipeline();

    if (isPipelineDisabled(stats)) {
      return NextResponse.json(
        { success: false, error: stats.reason, stats },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, stats }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Cron/refresh-employers] failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
