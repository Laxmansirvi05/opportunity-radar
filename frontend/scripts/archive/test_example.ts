import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: companies } = await supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(2);
  const { data: opps } = await supabase.from('opportunities').select('*').order('created_at', { ascending: false }).limit(2);
  
  console.log('--- NEWEST COMPANIES ---');
  console.log(JSON.stringify(companies, null, 2));
  console.log('--- NEWEST OPPORTUNITIES ---');
  console.log(JSON.stringify(opps, null, 2));
}
run();
