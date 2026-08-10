import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { denyIfNotCron } from '@/lib/cron-auth';
import { verifySchema, formatReport } from '@/lib/schema-guard';

export async function GET(request: Request) {
  // Security: Protect health endpoint with same Bearer token used by other cron routes
  const denied = denyIfNotCron(request);
  if (denied) return denied;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
       return NextResponse.json({ status: 'unhealthy', error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Schema drift check. This is the production home of the guard: four tables
    // once went missing from production and nothing noticed for weeks, because
    // a missing table only shows up as a 500 on the single path that touches it.
    // Running it here means a daily cron surfaces drift on its own.
    const schema = await verifySchema(supabase);
    if (!schema.healthy) {
      console.error(formatReport(schema));
    }

    // Fetch the most recent run from ingestion logs
    const { data: recentLogs, error } = await supabase
      .from('ingestion_logs')
      .select('created_at, provider, status')
      .order('created_at', { ascending: false })
      .limit(10); // fetch last 10 to see providers in the last run batch

    if (error) {
      throw error;
    }

    // Schema drift is reported on every path, and it alone can turn the
    // endpoint 'degraded' — ingestion can look perfectly healthy while a
    // missing table has three features dead.
    const schemaBlock = {
      healthy: schema.healthy,
      checked: schema.checks.length,
      failures: schema.failures.map((f) => ({
        object: f.name, kind: f.kind, status: f.status, breaks: f.breaks, detail: f.detail,
      })),
    };

    if (!recentLogs || recentLogs.length === 0) {
      return NextResponse.json({
        status: schema.healthy ? 'healthy' : 'degraded',
        last_refresh_timestamp: null,
        provider_count: 0,
        last_ingestion_status: 'No runs recorded',
        schema: schemaBlock,
      }, { status: schema.healthy ? 200 : 503 });
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
      status: schema.healthy ? 'healthy' : 'degraded',
      last_refresh_timestamp: latestTimestamp,
      provider_count: uniqueProviders.size,
      last_ingestion_status: hasFailures ? 'Failed (Partial)' : 'Success',
      schema: schemaBlock,
    }, { status: schema.healthy ? 200 : 503 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'unhealthy', error: message }, { status: 500 });
  }
}
