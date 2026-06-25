import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { count: dbTotal } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: dbPublished } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  
  // Test frontend anon query
  const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { count: frontendCount, error } = await anonSupabase.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  
  console.log('--- COUNTS ---');
  console.log(`DB Total: ${dbTotal}`);
  console.log(`DB Published: ${dbPublished}`);
  console.log(`Frontend API Returnable: ${frontendCount}`);
  if (error) console.log(error);
}
run();
