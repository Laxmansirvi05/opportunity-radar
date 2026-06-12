import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { count: oppCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: tagsCount } = await supabase.from('opportunity_tags').select('*', { count: 'exact', head: true });
  console.log(`Opportunities: ${oppCount}`);
  console.log(`Opportunity Tags: ${tagsCount}`);
  
  console.log('\nLast 5 opportunities:');
  const { data } = await supabase.from('opportunities').select('title, description, skills, deadline, source').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
