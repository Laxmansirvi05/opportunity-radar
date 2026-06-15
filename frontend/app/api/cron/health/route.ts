import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Security: Protect health endpoint with same Bearer token used by other cron routes
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
       return NextResponse.json({ status: 'unhealthy', error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the most recent run from ingestion logs
    const { data: recentLogs, error } = await supabase
      .from('ingestion_logs')
      .select('created_at, provider, status')
      .order('created_at', { ascending: false })
      .limit(10); // fetch last 10 to see providers in the last run batch

    if (error) {
      throw error;
    }

    if (!recentLogs || recentLogs.length === 0) {
      return NextResponse.json({
        status: 'healthy',
        last_refresh_timestamp: null,
        provider_count: 0,
        last_ingestion_status: 'No runs recorded'
      }, { status: 200 });
    }

    // Determine when the last run started (grouping by closest timestamp)
    const latestTimestamp = recentLogs[0].created_at;
    
    // Calculate provider count in the latest run window (within last 5 minutes of the most recent log)
    const latestDate = new Date(latestTimestamp);
    const recentBatch = recentLogs.filter(log => {
      const diff = latestDate.getTime() - new Date(log.created_at).getTime();
      return diff < 5 * 60 * 1000; // 5 minutes window
    });
    
    // Unique providers in this batch
    const uniqueProviders = new Set(recentBatch.map(log => log.provider));
    
    // Status (if any failed, overall status is 'Failed (Partial)', else 'Success')
    const hasFailures = recentBatch.some(log => log.status === 'FAILED');

    return NextResponse.json({
      status: 'healthy',
      last_refresh_timestamp: latestTimestamp,
      provider_count: uniqueProviders.size,
      last_ingestion_status: hasFailures ? 'Failed (Partial)' : 'Success'
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ status: 'unhealthy', error: err.message }, { status: 500 });
  }
}
