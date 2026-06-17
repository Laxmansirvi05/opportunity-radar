import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// We'll simulate the search function here to measure the payload and time accurately 
// since importing next.js specific modules in a bare node script might be flaky
async function measureSearch() {
  const start = performance.now();
  const q = 'software engineer';
  const term = q;
  
  // 1. Fetch related IDs
  const { data: comps } = await supabase.from('companies').select('id').ilike('name', `%${term}%`);
  const compIds = comps?.map(c => c.id) || [];
  
  const { data: tags } = await supabase.from('opportunity_tags').select('opportunity_id').ilike('tag_name', `%${term}%`);
  const tagOpps = tags?.map(t => t.opportunity_id) || [];

  // 2. Fetch main payload without description
  let query = supabase
    .from('opportunities')
    .select(`
      id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url,
      companies (id, name, logo_url, website_url),
      opportunity_tags (tag_name)
    `, { count: 'exact' })
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`);

  const safeQ = term.replace(/"/g, '""');
  const conditions = [];
  conditions.push(`fts.plfts(english)."${safeQ}"`);
  conditions.push(`location.ilike.%${term}%`);
  conditions.push(`category.ilike.%${term}%`);
  if (compIds.length > 0) conditions.push(`company_id.in.(${compIds.join(',')})`);
  if (tagOpps.length > 0) conditions.push(`id.in.(${tagOpps.join(',')})`);
  
  query = query.or(conditions.join(','));
  
  const { data, count, error } = await query.range(0, 19);

  const end = performance.now();
  console.log(`Payload search execution time: ${(end - start).toFixed(2)} ms`);
  console.log(`Found: ${count} opportunities`);
  if (error) console.error(error);
}

measureSearch();
