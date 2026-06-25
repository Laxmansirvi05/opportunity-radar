import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { count: noDesc } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).or("description.is.null,description.eq.''");
  const { count: total } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: noDeadline } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('deadline', null);
  const { count: noSalary } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('salary_range', null);
  const { count: noMode } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('mode', null);
  const { count: noSkills } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('skills', '{}');
  const { count: noRequirements } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('requirements', '{}');
  
  // Check schema for missing columns
  const { data: sampleCol } = await supabase.from('opportunities').select('*').limit(1);
  
  console.log('=== FIELD COMPLETENESS AUDIT ===');
  console.log(`Total Opportunities: ${total}`);
  console.log(`Empty description: ${noDesc} (${Math.round((noDesc!/total!)*100)}%)`);
  console.log(`No deadline: ${noDeadline} (${Math.round((noDeadline!/total!)*100)}%)`);
  console.log(`No salary_range: ${noSalary} (${Math.round((noSalary!/total!)*100)}%)`);
  console.log(`No mode: ${noMode} (${Math.round((noMode!/total!)*100)}%)`);
  console.log(`Empty skills[]: ${noSkills} (${Math.round((noSkills!/total!)*100)}%)`);
  console.log(`Empty requirements[]: ${noRequirements} (${Math.round((noRequirements!/total!)*100)}%)`);
  
  console.log('\n=== COLUMNS IN OPPORTUNITIES TABLE ===');
  if (sampleCol && sampleCol.length > 0) {
    console.log(Object.keys(sampleCol[0]).join('\n'));
  }
  
  // Check missing columns: duration, openings, perks, eligibility, stipend
  const row = sampleCol?.[0] as any;
  const expected = ['duration', 'openings', 'perks', 'eligibility', 'stipend'];
  expected.forEach(col => {
    console.log(`Column '${col}': ${col in (row || {}) ? '✅ EXISTS' : '❌ MISSING'}`);
  });
}
run();
