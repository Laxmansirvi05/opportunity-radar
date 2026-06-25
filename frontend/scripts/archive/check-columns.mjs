import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkColumns() {
  // We can fetch a single record and see its keys
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  if (data && data.length > 0) {
    const record = data[0];
    const keys = Object.keys(record);
    console.log("Columns found in opportunities table:");
    keys.sort().forEach(k => console.log(`- ${k}`));
  } else {
    console.log("No data found to infer columns from (or all fields might be null).");
  }
}

checkColumns();
