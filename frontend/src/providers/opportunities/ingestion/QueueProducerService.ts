import { createClient } from '@supabase/supabase-js';
import { InternshalaProvider } from '../providers/InternshalaProvider';
import { UnstopProvider } from '../providers/UnstopProvider';
import { QueuePayload } from '../base/OpportunityProvider';

export class QueueProducerService {
  private providers = [
    new InternshalaProvider(),
    new UnstopProvider()
  ];

  async runProducer() {
    console.log("=== QUEUE PRODUCER START ===");
    const allPayloads: QueuePayload[] = [];
    
    // 1. Discover URLs
    for (const provider of this.providers) {
      try {
        console.log(`Discovering list pages for ${provider.constructor.name}...`);
        const payloads = await provider.fetchListPages();
        allPayloads.push(...payloads);
        console.log(`Found ${payloads.length} URLs from ${provider.constructor.name}.`);
      } catch (err: any) {
        console.error(`Provider error:`, err.message);
      }
    }
    
    console.log(`\nTotal URLs discovered: ${allPayloads.length}`);

    // 2. Insert Queue Rows
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const adminDb = createClient(supabaseUrl, serviceRoleKey);
    let insertedCount = 0;
    let duplicateCount = 0;

    console.log(`Inserting into ingestion_queue...`);

    // In Supabase js, insert with { ignoreDuplicates: true } handles ON CONFLICT DO NOTHING natively 
    // for unique constraints (like source, source_id).
    // We batch the inserts to avoid payload too large errors.
    const batchSize = 100;
    for (let i = 0; i < allPayloads.length; i += batchSize) {
      const batch = allPayloads.slice(i, i + batchSize);
      const { data, error } = await adminDb
        .from('ingestion_queue')
        .insert(batch)
        .select();

      if (error && error.code === '23505') {
         // Duplicate caught, since Supabase JS throws if ignoreDuplicates is not explicitly passed.
         // Actually, let's pass { ignoreDuplicates: true } to properly use DO NOTHING.
      }
    }

    // Wait, let's do it properly with ignoreDuplicates: true or loop to count exact duplicates if ignored.
    // If we use { ignoreDuplicates: true } and no select(), we won't know how many were inserted.
    // Let's do it individually or check counts before/after if we want to log the exact number, 
    // but doing individually is safer for counting.
    
    for (const payload of allPayloads) {
      const { error } = await adminDb
        .from('ingestion_queue')
        .insert([payload]);
        
      if (error && error.code === '23505') {
        duplicateCount++;
      } else if (error) {
        console.error("Queue insert error:", error.message);
      } else {
        insertedCount++;
      }
    }

    console.log(`\nQueue rows inserted: ${insertedCount}`);
    console.log(`Queue duplicates ignored: ${duplicateCount}`);

    // 3. Queue Total Count
    const { count } = await adminDb.from('ingestion_queue').select('*', { count: 'exact', head: true });
    console.log(`Queue total count: ${count}`);

    console.log("=== QUEUE PRODUCER COMPLETE ===");
    
    return {
      discovered: allPayloads.length,
      inserted: insertedCount,
      ignored: duplicateCount,
      total: count
    };
  }
}
