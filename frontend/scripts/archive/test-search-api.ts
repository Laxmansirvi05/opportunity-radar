import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSearch(keyword: string) {
  const start = Date.now();
  const { data, error } = await supabase.rpc('search_opportunities_rpc', {
    search_query: keyword,
    category_filter: '[]',
    source_filter: '[]',
    mode_filter: '[]',
    is_paid_filter: null,
    verified_filter: null,
    limit_val: 20,
    offset_val: 0
  });
  
  const end = Date.now();
  if (error) {
    console.error(`[ERROR] Search "${keyword}":`, error.message);
  } else {
    console.log(`[OK] Search "${keyword}": ${data?.length || 0} results in ${end - start}ms`);
  }
}

async function run() {
  await testSearch('amazon');
  await testSearch('python');
  await testSearch('frontend');
  await testSearch('software');
  await testSearch('ai');
  await testSearch('machine learning');
  await testSearch('remote');
}

run().catch(console.error);
