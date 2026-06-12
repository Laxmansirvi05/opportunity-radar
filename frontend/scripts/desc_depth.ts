import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // Internshala: breakdown by whether record has desc & deadline
  // Case 1: Has desc + skills + deadline (fully enriched, detail page was hit)
  const { count: fullEnriched } = await supabase.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'internshala')
    .not('description', 'is', null).neq('description', '')
    .not('skills', 'is', null).neq('skills', '{}')
    .not('deadline', 'is', null);

  // Case 2: Has desc only (detail fetched but deadline not found)
  const { count: hasDescNoDeadline } = await supabase.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'internshala')
    .not('description', 'is', null).neq('description', '')
    .is('deadline', null);

  // Case 3: No desc at all (detail page not fetched, or failed)
  const { count: noDesc } = await supabase.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'internshala')
    .or('description.is.null,description.eq.');

  console.log('=== INTERNSHALA ENRICHMENT BREAKDOWN ===');
  console.log(`Fully enriched (desc + skills + deadline): ${fullEnriched}`);
  console.log(`Has description but no deadline: ${hasDescNoDeadline}`);
  console.log(`No description at all: ${noDesc}`);
  
  // Check for skill contamination: Internshala skills include non-skills like "Certificate", "Job offer"
  console.log('\n=== INTERNSHALA SKILL QUALITY CHECK ===');
  const { data: skillSamples } = await supabase.from('opportunities')
    .select('title, skills')
    .eq('source', 'internshala')
    .not('skills', 'is', null)
    .neq('skills', '{}')
    .limit(5);
  (skillSamples||[]).forEach((o:any) => {
    console.log(`  "${o.title}": [${(o.skills||[]).join(' | ')}]`);
  });

  // Check company_name quality - whitespace issues
  console.log('\n=== INTERNSHALA COMPANY NAME QUALITY ===');
  const { data: companies } = await supabase.from('opportunities')
    .select('company_name')
    .eq('source', 'internshala')
    .limit(5);
  (companies||[]).forEach((o:any) => {
    console.log(`  [${JSON.stringify(o.company_name)}]`);
  });

  // Unstop missing deadline - is it a category issue?
  console.log('\n=== UNSTOP NO DEADLINE: CATEGORY + SAMPLE ===');
  const { data: noDeadUnstop } = await supabase.from('opportunities')
    .select('title, category, company_name')
    .eq('source', 'unstop')
    .is('deadline', null)
    .limit(5);
  (noDeadUnstop||[]).forEach((o:any) => {
    console.log(`  [${o.category}] "${o.title}" @ ${o.company_name}`);
  });

  // Check requirements column (not in schema)
  console.log('\n=== SCHEMA: Does requirements column exist? ===');
  const { data: req, error: reqErr } = await supabase.from('opportunities')
    .select('requirements')
    .limit(1);
  if (reqErr) {
    console.log(`requirements column: DOES NOT EXIST → ${reqErr.message}`);
  } else {
    console.log(`requirements column: EXISTS. Sample: ${JSON.stringify(req?.[0]?.requirements)}`);
  }
}

run().catch(console.error);
