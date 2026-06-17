import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('ingestion_logs')
    .select('provider, execution_time_ms, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('--- LAST 10 LOGS ---');
  const last10 = data.slice(0, 10);
  last10.forEach((log, index) => {
    console.log(`${index + 1}. [${log.created_at}] Provider: ${log.provider.padEnd(20)} | Status: ${log.status.padEnd(7)} | Duration: ${log.execution_time_ms}ms`);
  });

  if (last10.length === 0) {
      console.log("No logs found in the database.");
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const logsLast7Days = data.filter(log => new Date(log.created_at) >= sevenDaysAgo);

  const ingestionRuns = logsLast7Days.filter(log => log.provider !== 'MaintenanceService');
  const maintenanceRuns = logsLast7Days.filter(log => log.provider === 'MaintenanceService');

  console.log('\n--- ANALYSIS LAST 7 DAYS ---');
  console.log(`Ingestion runs in last 7 days: ${ingestionRuns.length}`);
  if (ingestionRuns.length > 0) {
    console.log(`Last ingestion run: ${ingestionRuns[0].created_at}`);
  }

  console.log(`Maintenance runs in last 7 days: ${maintenanceRuns.length}`);
  if (maintenanceRuns.length > 0) {
    console.log(`Last maintenance run: ${maintenanceRuns[0].created_at}`);
  }
}

main();
