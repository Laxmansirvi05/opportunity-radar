import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function checkDatabase() {
  console.log('--- DATABASE STATS ---');
  console.log(`ENABLE_OPP_INGESTION is: ${process.env.ENABLE_OPP_INGESTION || 'not set'}`);
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  const { count: countOpp } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`Opportunities count: ${countOpp}`);

  const { count: countComp } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  console.log(`Companies count: ${countComp}`);

  console.log('\n--- 20 NEWEST OPPORTUNITIES ---');
  const { data: opps } = await supabase.from('opportunities').select('title, company_name, created_at').order('created_at', { ascending: false }).limit(20);
  console.table(opps);

  console.log('\n--- 20 NEWEST COMPANIES ---');
  const { data: comps } = await supabase.from('companies').select('name, created_at').order('created_at', { ascending: false }).limit(20);
  console.table(comps);

  console.log('\n--- 20 OPPORTUNITIES WITH SKILLS ---');
  const { data: oppsWithSkills } = await supabase.from('opportunity_tags').select('opportunity_id, tags').limit(20);
  console.table(oppsWithSkills);

  console.log('\n--- 20 OPPORTUNITIES WITH LOGOS ---');
  const { data: compsWithLogos } = await supabase.from('companies').select('name, logo_url').not('logo_url', 'is', null).limit(20);
  console.table(compsWithLogos);
}

checkDatabase().catch(console.error);
