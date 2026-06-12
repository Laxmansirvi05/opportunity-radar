import { QueueConsumerService } from '../src/providers/opportunities/ingestion/QueueConsumerService';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log("=== QUEUE WORKER VERIFICATION ===");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  // 1. Queue Before
  const { count: pendingBefore } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: processingBefore } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing');
  const { count: completedBefore } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed');
  
  console.log(`\nQueue Before:`);
  console.log(`- Pending: ${pendingBefore}`);
  console.log(`- Processing: ${processingBefore}`);
  console.log(`- Completed: ${completedBefore}`);

  // Memory before
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  const consumer = new QueueConsumerService();
  const stats = await consumer.processBatch(10); // Run a small sample batch

  // Memory after
  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

  // 2. Queue After
  const { count: pendingAfter } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: processingAfter } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing');
  const { count: completedAfter } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed');
  const { count: failedAfter } = await db.from('ingestion_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed');

  console.log(`\nQueue After:`);
  console.log(`- Pending: ${pendingAfter}`);
  console.log(`- Processing: ${processingAfter}`);
  console.log(`- Completed: ${completedAfter}`);
  console.log(`- Failed: ${failedAfter}`);

  console.log(`\nOpportunities Inserted/Updated: ${stats.inserted}`);
  console.log(`Memory Usage: ~${(memAfter - memBefore).toFixed(2)} MB difference (Peak likely higher but bounded)`);
  console.log("=== VERIFICATION COMPLETE ===");
}

main().catch(console.error);
