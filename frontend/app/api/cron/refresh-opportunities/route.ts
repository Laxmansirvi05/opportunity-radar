import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpportunityIngestionService } from '@/../src/providers/opportunities/ingestion/OpportunityIngestionService';
import { YCProvider } from '@/../src/providers/opportunities/providers/YCProvider';
import { UnstopProvider } from '@/../src/providers/opportunities/providers/UnstopProvider';
import { WellfoundProvider } from '@/../src/providers/opportunities/providers/WellfoundProvider';
import { InternshalaProvider } from '@/../src/providers/opportunities/providers/InternshalaProvider';

export async function GET(request: Request) {
  // Security check: Protect the cron endpoint using a Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // We use the service_role key to bypass RLS for background bulk ingestion
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase admin credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const providers = [
      new YCProvider(),
      new UnstopProvider(),
      new WellfoundProvider(),
      new InternshalaProvider(),
    ];

    const ingestionService = new OpportunityIngestionService(providers, supabase);
    
    // Run pipeline. Includes fetch, normalize, validate, deduplicate, upsert, and logging per provider.
    // Also handles expiration of old opportunities.
    const stats = await ingestionService.runPipeline();

    return NextResponse.json({ success: true, stats }, { status: 200 });
  } catch (error: any) {
    console.error('Cron job failed to initialize:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
