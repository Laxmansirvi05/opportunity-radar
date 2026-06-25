import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkDuplicates() {
  console.log("Checking for duplicate (source, source_id) rows...");
  
  // We can query the duplicates by using a raw SQL or by fetching all and checking in memory.
  // Since we don't have direct SQL RPC for this, we'll fetch all source, source_id pairs.
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, source, source_id');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  const map = new Map<string, string[]>();
  const duplicates: any[] = [];

  for (const row of data) {
    const key = `${row.source}::${row.source_id}`;
    if (!map.has(key)) {
      map.set(key, [row.id]);
    } else {
      map.get(key)!.push(row.id);
      duplicates.push({ key, ids: map.get(key) });
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate sets!`);
    console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));
    process.exit(1);
  } else {
    console.log("No duplicates found! Safe to add UNIQUE constraint.");
    process.exit(0);
  }
}

checkDuplicates();
