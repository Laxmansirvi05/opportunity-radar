import { QueueConsumerService } from '../src/providers/opportunities/ingestion/QueueConsumerService';

async function verifyConcurrency() {
  console.log("=== Concurrency Verification Test ===");
  console.log("Starting two worker instances simultaneously...");

  // Note: Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment
  // and that the DB has the claim_queue_batch RPC deployed.
  try {
    const workerA = new QueueConsumerService();
    const workerB = new QueueConsumerService();

    // Run both workers at the exact same time
    const results = await Promise.all([
      workerA.processBatch(5),
      workerB.processBatch(5)
    ]);

    console.log("\n=== Test Results ===");
    console.log("Worker A processed:", results[0]);
    console.log("Worker B processed:", results[1]);

    console.log("\n✅ Verification Steps:");
    console.log("1. Check Supabase Dashboard for the RPC deployment.");
    console.log("2. Seed ingestion_queue with 5 'pending' rows.");
    console.log("3. Run this script via: npx ts-node verify-concurrency.ts");
    console.log("4. Worker A should claim 5 rows.");
    console.log("5. Worker B should claim 0 rows (since Worker A locked them atomically).");
    console.log("6. No duplicate processing should occur.");

  } catch (error) {
    console.error("Test failed to run. Ensure env vars are set properly.", error);
  }
}

verifyConcurrency();
