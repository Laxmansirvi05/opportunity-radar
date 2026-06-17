import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  const tables = ['opportunities', 'companies', 'opportunity_tags', 'ingestion_logs'];
  console.log('--- SECTION C RESULTS ---');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${t}: Error (${error.message})`);
    } else {
      console.log(`Table ${t}: ${count} rows`);
    }
  }
}

checkDatabase();
