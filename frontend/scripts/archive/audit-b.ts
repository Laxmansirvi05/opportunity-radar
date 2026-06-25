import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearchPerformance() {
  const start = performance.now();
  const q = 'software engineer';
  const { data, count, error } = await supabase
    .from('opportunities')
    .select('id, title', { count: 'exact' })
    .in('status', ['Published', 'Closing Soon'])
    .or(`fts.plfts(english)."${q}",location.ilike.%${q}%,category.ilike.%${q}%`)
    .range(0, 19);
  
  const end = performance.now();
  console.log(`Search query execution time: ${(end - start).toFixed(2)} ms`);
  console.log(`Found: ${count} opportunities`);
  if (error) console.error(error);
}

testSearchPerformance();
