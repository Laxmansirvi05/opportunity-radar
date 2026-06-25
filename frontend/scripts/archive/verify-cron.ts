import { GET as refreshGet } from '../app/api/cron/refresh-opportunities/route';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  process.env.CRON_SECRET = 'verify_secret_123';
  process.env.ENABLE_OPP_INGESTION = 'true'; // ensure ingestion is enabled
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { count: countBefore } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`Opportunities before: ${countBefore}`);

  console.log('Triggering /api/cron/refresh-opportunities manually...');
  
  const req = new Request('http://localhost/api/cron/refresh-opportunities', {
    headers: { 'authorization': 'Bearer verify_secret_123' }
  });
  
  const startTime = Date.now();
  const res = await refreshGet(req);
  const data = await res.json();
  const duration = Date.now() - startTime;
  
  console.log(`\nRoute returned HTTP ${res.status}`);
  if (res.status !== 200) {
    console.log(`Response body:`, JSON.stringify(data, null, 2));
  }

  const { count: countAfter } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`\nOpportunities after: ${countAfter}`);
  console.log(`New opportunities inserted: ${countAfter - countBefore}`);

  console.log('\n--- NEW INGESTION LOGS ---');
  const { data: logs } = await supabase
    .from('ingestion_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  const recentLogs = logs?.filter(l => new Date(l.created_at).getTime() >= startTime - 1000) || [];
  
  if (recentLogs.length > 0) {
    console.log(`Found ${recentLogs.length} new log records:`);
    recentLogs.forEach(log => {
      console.log(`- Provider: ${log.provider.padEnd(20)} | Status: ${log.status} | Inserted: ${log.records_inserted} | Updated: ${log.records_updated} | Skipped: ${log.records_skipped_dup} | Time: ${log.execution_time_ms}ms`);
    });
  } else {
    console.log('No new log records found.');
  }
}

verify().catch(console.error);
