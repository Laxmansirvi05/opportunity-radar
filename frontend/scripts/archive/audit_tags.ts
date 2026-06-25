import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Count total tags
  const { count: tagCount } = await supabase.from('opportunity_tags').select('*', { count: 'exact', head: true });
  
  // Count opportunities with at least one tag
  const { data: oppsWithTags } = await supabase.from('opportunity_tags').select('opportunity_id');
  const distinctOpps = new Set(oppsWithTags?.map(r => r.opportunity_id));
  
  // Count opportunities with non-empty skills array
  const { data: oppsWithSkills } = await supabase
    .from('opportunities')
    .select('id, skills, description')
    .neq('skills', '{}')
    .limit(5);

  // Count opps with empty descriptions (=no skill extraction possible)
  const { count: emptyDesc } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .or("description.is.null,description.eq.''");

  // Sample a real opportunity to check its data
  const { data: sample } = await supabase
    .from('opportunities')
    .select('id, title, description, skills, requirements, deadline, salary_range')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('=== TAGS AUDIT ===');
  console.log('Total rows in opportunity_tags:', tagCount);
  console.log('Distinct opportunities WITH tags:', distinctOpps.size);
  
  console.log('\n=== SKILLS IN OPPORTUNITIES TABLE ===');
  console.log('Opportunities with non-empty skills[]:', oppsWithSkills?.length);
  if (oppsWithSkills?.length) {
    oppsWithSkills.forEach(o => console.log('  skills:', o.skills));
  }
  
  console.log('\n=== DESCRIPTION QUALITY ===');
  console.log('Opportunities with EMPTY/NULL description:', emptyDesc);

  console.log('\n=== SAMPLE RECENT OPPORTUNITIES ===');
  sample?.forEach(o => {
    console.log('---');
    console.log('title:', o.title);
    console.log('description (first 100 chars):', o.description?.slice(0, 100) || '(empty)');
    console.log('skills:', o.skills);
    console.log('requirements:', o.requirements);
    console.log('deadline:', o.deadline);
    console.log('salary_range:', o.salary_range);
  });
}
run();
