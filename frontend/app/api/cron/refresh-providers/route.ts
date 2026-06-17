import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase admin credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { OpportunityIngestionService } = await import('@/src/providers/opportunities/ingestion/OpportunityIngestionService');
    const { WellfoundProvider } = await import('@/src/providers/opportunities/providers/WellfoundProvider');

    const providers = [
      new WellfoundProvider(),
    ];

    const ingestionService = new OpportunityIngestionService(providers, supabase);
    const stats = await ingestionService.runPipeline();

    return NextResponse.json({ success: true, stats }, { status: 200 });
  } catch (error: any) {
    console.error('Cron job failed to initialize:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
