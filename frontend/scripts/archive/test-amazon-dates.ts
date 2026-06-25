import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data } = await db.from('opportunities').select('title, posted_at, created_at').eq('source', 'amazon').limit(5);
  console.log(data);
}
check();
