import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRpc() {
  const { data, error } = await supabase.rpc('search_opportunities_rpc', {
    search_query: 'ai',
    filter_category: null,
    filter_mode: null,
    filter_experience_level: null,
    filter_is_paid: null,
    filter_location: null,
    filter_freshness_interval: null,
    filter_deadline_min: null,
    filter_deadline_max: null,
    sort_by: 'relevance',
    page_offset: 0,
    page_limit: 5,
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success. Count:', data.length);
  }
}

checkRpc().catch(console.error);
