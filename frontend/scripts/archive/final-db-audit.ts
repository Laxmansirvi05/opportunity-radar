import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runAudit() {
  console.log("--- DATABASE AUDIT ---");
  
  // Total count
  const { count: total } = await db.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`Total Opportunities: ${total}`);

  // Duplicate source_id count
  const { data: duplicates } = await db.rpc('get_duplicate_source_ids');
  // fallback if rpc doesn't exist
  if (!duplicates) {
    const { data: allSourceIds } = await db.from('opportunities').select('source_id');
    const counts = allSourceIds?.reduce((acc: any, row: any) => {
      acc[row.source_id] = (acc[row.source_id] || 0) + 1;
      return acc;
    }, {});
    const duplicateCount = Object.values(counts || {}).filter((v: any) => v > 1).length;
    console.log(`Duplicate source_id count: ${duplicateCount}`);
  }

  // Missing apply_url
  const { count: missingUrl } = await db.from('opportunities').select('*', { count: 'exact', head: true }).or('apply_url.is.null,apply_url.eq.');
  console.log(`Missing apply_url count: ${missingUrl}`);

  // Missing descriptions
  const { count: missingDesc } = await db.from('opportunities').select('*', { count: 'exact', head: true }).or('description.is.null,description.eq.');
  console.log(`Missing descriptions count: ${missingDesc}`);

  // Missing posted_at
  const { count: missingPosted } = await db.from('opportunities').select('*', { count: 'exact', head: true }).is('posted_at', null);
  console.log(`Missing posted_at count: ${missingPosted}`);

  // Missing ingested_at
  const { count: missingIngested } = await db.from('opportunities').select('*', { count: 'exact', head: true }).is('ingested_at', null);
  console.log(`Missing ingested_at count: ${missingIngested}`);

  // Empty skills count
  const { count: emptySkills } = await db.from('opportunities').select('*', { count: 'exact', head: true }).filter('skills', 'eq', '[]');
  console.log(`Empty skills count: ${emptySkills}`);

  // Status distribution
  const { data: allStatus } = await db.from('opportunities').select('status');
  const statusCounts = allStatus?.reduce((acc: any, row: any) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  console.log("Status distribution:", statusCounts);

  // Source distribution
  const { data: allSource } = await db.from('opportunities').select('source');
  const sourceCounts = allSource?.reduce((acc: any, row: any) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {});
  console.log("Source distribution:", sourceCounts);
}

runAudit().catch(console.error);
