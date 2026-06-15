import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("=== EXACT DATABASE COUNTS ===\n");

  const { count: totalCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`1. Total opportunities: ${totalCount}`);

  const { count: activeCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  console.log(`2. Active opportunities: ${activeCount}`);

  const { count: publishedCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Published');
  console.log(`3. Published opportunities: ${publishedCount}`);

  const { count: closingSoonCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Closing Soon');
  console.log(`4. Closing Soon opportunities: ${closingSoonCount}`);

  const { count: expiredCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Expired');
  console.log(`5. Expired opportunities: ${expiredCount}`);

  // Fetch ALL sources using pagination to avoid 1000-row limit
  let allSources: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase.from('opportunities').select('source').range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    allSources = allSources.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const sourceCounts: Record<string, number> = {};
  for (const row of allSources) {
    const s = row.source || 'unknown';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }

  const sortedSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\n6. All providers by count:`);
  sortedSources.forEach(([source, count], idx) => {
    console.log(`   ${idx + 1}. ${source}: ${count}`);
  });

  console.log(`\n   Total from source counts: ${sortedSources.reduce((sum, [, c]) => sum + c, 0)}`);
}

run().catch(console.error);
