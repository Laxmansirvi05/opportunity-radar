import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const adminDb = createClient(supabaseUrl, serviceRoleKey);
const anonDb = createClient(supabaseUrl, anonKey);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify() {
  console.log("=== QUEUE VERIFICATION START ===");
  
  // 1. Service Role Insert 3 records
  console.log("\n[1] Inserting 3 test records (service_role)");
  const records = [
    { source: 'internshala', source_id: 'i-123', url: 'https://internshala.com/123' },
    { source: 'unstop', source_id: 'u-456', url: 'https://unstop.com/456' },
    { source: 'wellfound', source_id: 'w-789', url: 'https://wellfound.com/789' }
  ];
  
  const { data: inserted, error: insertErr } = await adminDb
    .from('ingestion_queue')
    .insert(records)
    .select();
    
  if (insertErr) {
    console.error("Insert Error:", insertErr.message);
    return;
  }
  console.log(`SUCCESS: Inserted ${inserted.length} rows.`);

  // 2. Duplicate Prevention (ON CONFLICT DO NOTHING)
  console.log("\n[2] Testing Duplicate Prevention (ON CONFLICT)");
  const { error: dupErr } = await adminDb
    .from('ingestion_queue')
    .insert([{ source: 'internshala', source_id: 'i-123', url: 'dup-url' }])
    .select();
    
  if (dupErr && dupErr.code === '23505') {
    console.log("SUCCESS: Database natively rejected duplicate via constraint 23505.");
  } else if (!dupErr) {
    console.error("FAIL: Duplicate was inserted!");
  } else {
    console.error("FAIL: Unknown error", dupErr);
  }

  // Verify row count
  const { count } = await adminDb.from('ingestion_queue').select('*', { count: 'exact', head: true });
  console.log(`CURRENT QUEUE ROW COUNT: ${count}`);

  // 3. Updated_at Trigger
  console.log("\n[3] Testing updated_at trigger");
  const firstRecord = inserted![0];
  const originalUpdated = new Date(firstRecord.updated_at).getTime();
  
  await sleep(1500); 
  
  await adminDb.from('ingestion_queue').update({ status: 'processing' }).eq('id', firstRecord.id);
  const { data: updatedRecord } = await adminDb.from('ingestion_queue').select('*').eq('id', firstRecord.id).single();
  const newUpdated = new Date(updatedRecord!.updated_at).getTime();
  
  if (newUpdated > originalUpdated) {
    console.log(`SUCCESS: updated_at changed from ${firstRecord.updated_at} to ${updatedRecord!.updated_at}`);
  } else {
    console.error("FAIL: updated_at did not change!");
  }

  // 4. RLS Verification
  console.log("\n[4] Testing RLS for Authenticated / Anon users");
  const { data: anonData, error: anonErr } = await anonDb.from('ingestion_queue').select('*');
  if (anonData && anonData.length === 0) {
     console.log("SUCCESS: Anon user cannot see any rows (returned []).");
  } else {
     console.error("FAIL: Anon user behavior unexpected.", anonErr || anonData);
  }
  
  // Cleanup
  await adminDb.from('ingestion_queue').delete().in('source_id', ['i-123', 'u-456', 'w-789']);
  console.log("\n=== VERIFICATION COMPLETE ===");
}

verify().catch(console.error);
