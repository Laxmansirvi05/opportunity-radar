import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // Overall counts
  const { count: total } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: hasDesc } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('description', 'is', null).neq('description', '');
  const { count: hasSkills } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('skills', 'is', null).neq('skills', '{}');
  const { count: hasDeadline } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('deadline', 'is', null);
  const { count: hasResp } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('responsibilities', 'is', null).neq('responsibilities', '{}');

  console.log('\n=== OVERALL COUNTS ===');
  console.log(`Total: ${total}`);
  console.log(`Has Description: ${hasDesc} | Missing: ${(total||0)-(hasDesc||0)}`);
  console.log(`Has Skills: ${hasSkills} | Missing: ${(total||0)-(hasSkills||0)}`);
  console.log(`Has Deadline: ${hasDeadline} | Missing: ${(total||0)-(hasDeadline||0)}`);
  console.log(`Has Responsibilities: ${hasResp} | Missing: ${(total||0)-(hasResp||0)}`);
  
  // Coverage percentages
  console.log('\n=== COVERAGE % ===');
  const pct = (n: number | null) => (((n||0) / (total||1)) * 100).toFixed(1) + '%';
  console.log(`Description Coverage: ${pct(hasDesc)}`);
  console.log(`Skills Coverage: ${pct(hasSkills)}`);
  console.log(`Deadline Coverage: ${pct(hasDeadline)}`);
  console.log(`Responsibilities Coverage: ${pct(hasResp)}`);

  // --- BY SOURCE ---
  const sources = ['internshala', 'unstop', 'wellfound', 'yc', 'devfolio', 'gsoc', 'oureachy', 'lfx', 'hack2skill', 'amazon', 'github', 'atlassian'];
  console.log('\n=== BY SOURCE ===');
  for (const src of sources) {
    const { count: srcTotal } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('source', src);
    if (!srcTotal) continue;
    const { count: srcDesc } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('source', src).not('description', 'is', null).neq('description', '');
    const { count: srcSkills } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('source', src).not('skills', 'is', null).neq('skills', '{}');
    const { count: srcDeadline } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('source', src).not('deadline', 'is', null);
    const { count: srcResp } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('source', src).not('responsibilities', 'is', null).neq('responsibilities', '{}');
    console.log(`\n[${src.toUpperCase()}] Total: ${srcTotal}`);
    console.log(`  Description: ${srcDesc}/${srcTotal} (${(((srcDesc||0)/(srcTotal||1))*100).toFixed(1)}%)`);
    console.log(`  Skills:      ${srcSkills}/${srcTotal} (${(((srcSkills||0)/(srcTotal||1))*100).toFixed(1)}%)`);
    console.log(`  Deadline:    ${srcDeadline}/${srcTotal} (${(((srcDeadline||0)/(srcTotal||1))*100).toFixed(1)}%)`);
    console.log(`  Responsibilities: ${srcResp}/${srcTotal} (${(((srcResp||0)/(srcTotal||1))*100).toFixed(1)}%)`);
  }

  // 10 examples missing content
  console.log('\n=== 10 EXAMPLES MISSING CONTENT ===');
  const { data: missing } = await supabase.from('opportunities')
    .select('id, title, company_name, source, description, skills, deadline, responsibilities')
    .or('description.is.null,description.eq.,skills.is.null,skills.eq.{},deadline.is.null,responsibilities.is.null')
    .in('status', ['Published', 'Closing Soon'])
    .limit(10);
  
  (missing || []).forEach((o: any) => {
    const missingFields = [];
    if (!o.description || o.description === '') missingFields.push('description');
    if (!o.skills || o.skills.length === 0) missingFields.push('skills');
    if (!o.deadline) missingFields.push('deadline');
    if (!o.responsibilities || o.responsibilities.length === 0) missingFields.push('responsibilities');
    console.log(`\nTitle: ${o.title}`);
    console.log(`Company: ${o.company_name}`);
    console.log(`Source: ${o.source}`);
    console.log(`Missing: [${missingFields.join(', ')}]`);
  });

  // Check company_name presence
  const { count: noCompanyName } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('company_name', null);
  console.log(`\n=== EXTRA ===`);
  console.log(`Missing company_name: ${noCompanyName}/${total}`);
}

run().catch(console.error);
