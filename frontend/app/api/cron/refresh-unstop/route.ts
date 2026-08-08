import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';

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
    const { UnstopProvider } = await import('@/src/providers/opportunities/providers/UnstopProvider');

    const providers = [
      new UnstopProvider(),
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
