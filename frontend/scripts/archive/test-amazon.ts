import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';
import { AmazonProvider } from '../src/providers/opportunities/providers/AmazonProvider';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runVerification() {
  console.log("\n--- Starting Amazon Provider Verification ---");
  
  // Get initial count of active opportunities
  const { count: initialCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Published');

  const provider = new AmazonProvider();
  const service = new OpportunityIngestionService([provider], supabase);

  const start = Date.now();
  const stats = await service.runPipeline();
  const elapsedMs = Date.now() - start;

  // Get final count of active opportunities
  const { count: finalCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Published');

  console.log(`\nVerification complete in ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} seconds)`);
  console.log(`\n--- Stats ---`);
  console.log(`Records fetched: ${stats.processed}`);
  console.log(`Records validated: ${stats.valid}`);
  console.log(`Records inserted: ${stats.upserted - stats.skipped_dup}`); // Upserted combines both inserted/updated, skipped_dup is tracked globally
  // We can't strictly differentiate inserted vs updated from globalStats anymore easily, but wait, the flushBatch does:
  // Let's query ingestion_logs for exact counts.
  
  const { data: logs } = await supabase
    .from('ingestion_logs')
    .select('*')
    .eq('provider', 'AmazonProvider')
    .order('created_at', { ascending: false })
    .limit(1);

  if (logs && logs.length > 0) {
    const log = logs[0];
    console.log(`\n--- Exact DB Metrics (from ingestion_logs) ---`);
    console.log(`Records processed: ${log.records_processed}`);
    console.log(`Records inserted: ${log.records_inserted}`);
    console.log(`Records updated: ${log.records_updated}`);
    console.log(`Records skipped (dup): ${log.records_skipped_dup}`);
    console.log(`Records rejected: ${log.records_rejected}`);
  }

  console.log(`\n--- Capacity ---`);
  console.log(`Initial active opportunity count: ${initialCount}`);
  console.log(`Final active opportunity count: ${finalCount}`);
  
  process.exit(0);
}

runVerification();
