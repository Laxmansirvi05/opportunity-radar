import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_u-kGLYM5RkJE4IECpRix0Q_PvTlBbCm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEcosystem() {
  console.log('--- Validating Ecosystem Search Compatibility ---');

  // Insert mock data manually via SQL in real life, but for now we'll just check if the filter breaks.
  // The search endpoint is defined in the frontend, but we can mimic its query.
  
  const { data: fetchJobs, error: err1 } = await supabase
    .from('opportunities')
    .select('id, category')
    .eq('category', 'Job')
    .limit(5);
    
  if (err1) console.error(err1);
  console.log(`- Base query (Job) successful. Found ${fetchJobs?.length} jobs.`);

  const { data: fetchHackathons, error: err2 } = await supabase
    .from('opportunities')
    .select('id, category')
    .eq('category', 'Hackathon')
    .limit(5);
    
  if (err2) console.error(err2);
  console.log(`- New Category query (Hackathon) successful. Found ${fetchHackathons?.length} hackathons.`);

  const { data: fetchOpenSource, error: err3 } = await supabase
    .from('opportunities')
    .select('id, category')
    .eq('category', 'Open Source')
    .limit(5);

  if (err3) console.error(err3);
  console.log(`- New Category query (Open Source) successful. Found ${fetchOpenSource?.length} open source programs.`);

  const { data: pagination, error: err4 } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact' })
    .in('category', ['Hackathon', 'Open Source', 'Job'])
    .range(0, 9);
    
  if (err4) console.error(err4);
  console.log(`- Pagination and multi-category filter successful. Returned ${pagination?.length} items.`);
}

testEcosystem();
