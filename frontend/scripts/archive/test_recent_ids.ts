import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data } = await supabase.from('opportunities')
    .select('id, title, source')
    .order('updated_at', { ascending: false })
    .limit(3);
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
