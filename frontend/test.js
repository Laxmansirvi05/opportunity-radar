
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  // Try fetching tracker data without authentication to see if schema works
  // We expect empty data or RLS error, but not a syntax error
  const { data, error } = await supabase
    .from('application_tracker')
    .select(`
      id,
      status,
      notes,
      opportunity_id,
      opportunities:opportunity_id (
        id,
        title,
        companies:company_id (
          name,
          logo_url
        )
      )
    `)
    .limit(1);

  console.log('Test 1:', error);

  const { data: d2, error: e2 } = await supabase
    .from('application_tracker')
    .select(`
      id,
      status,
      notes,
      opportunity_id,
      opportunities (
        id,
        title,
        companies (
          name,
          logo_url
        )
      )
    `)
    .limit(1);

  console.log('Test 2:', e2);
}

test();
