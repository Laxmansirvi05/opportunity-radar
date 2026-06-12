import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // 10 missing desc (all from internshala since they're the problem)
  console.log('=== 5 INTERNSHALA MISSING DESC ===');
  const { data: a } = await supabase.from('opportunities')
    .select('title, company_name, source, description, skills, deadline')
    .eq('source', 'internshala')
    .or('description.is.null,description.eq.')
    .limit(5);
  (a||[]).forEach((o:any) => {
    const m = [];
    if (!o.description || o.description === '') m.push('description');
    if (!o.deadline) m.push('deadline');
    if (!o.skills || o.skills.length === 0) m.push('skills');
    console.log(`  [${o.source}] "${o.title}" @ ${o.company_name} → Missing: [${m.join(', ')}]`);
  });

  console.log('\n=== 5 UNSTOP MISSING DEADLINE ===');
  const { data: b } = await supabase.from('opportunities')
    .select('title, company_name, source, description, skills, deadline')
    .eq('source', 'unstop')
    .is('deadline', null)
    .limit(5);
  (b||[]).forEach((o:any) => {
    const m = [];
    if (!o.description || o.description === '') m.push('description');
    if (!o.deadline) m.push('deadline');
    if (!o.skills || o.skills.length === 0) m.push('skills');
    console.log(`  [${o.source}] "${o.title}" @ ${o.company_name} → Missing: [${m.join(', ')}]`);
  });

  // Check schema for responsibilities column
  console.log('\n=== SCHEMA CHECK ===');
  const { data: schema, error: schErr } = await supabase.rpc('version');
  
  // Test responsibilities directly
  const { data: rtest, error: rerr } = await supabase.from('opportunities')
    .select('responsibilities')
    .limit(1);
  console.log('Responsibilities field sample:', JSON.stringify(rtest));
  console.log('Responsibilities error:', rerr?.message);

  // Internshala detail check - skills quality
  console.log('\n=== INTERNSHALA SKILL QUALITY SAMPLE ===');
  const { data: skillCheck } = await supabase.from('opportunities')
    .select('title, skills')
    .eq('source', 'internshala')
    .not('skills', 'is', null)
    .neq('skills', '{}')
    .limit(3);
  (skillCheck||[]).forEach((o:any) => {
    console.log(`  "${o.title}" → skills: [${(o.skills||[]).join(', ')}]`);
  });

  // Unstop deadline missing analysis - are they hackathons?
  console.log('\n=== UNSTOP MISSING DEADLINE - CATEGORY BREAKDOWN ===');
  const { data: catBreak } = await supabase.from('opportunities')
    .select('category, status')
    .eq('source', 'unstop')
    .is('deadline', null)
    .limit(50);
  const cats: Record<string, number> = {};
  (catBreak||[]).forEach((o:any) => { cats[o.category] = (cats[o.category]||0)+1; });
  console.log(JSON.stringify(cats, null, 2));

  // Internshala - are skills from detail page or listing page?
  console.log('\n=== INTERNSHALA 1 FULL RECORD (most recent with desc) ===');
  const { data: intr } = await supabase.from('opportunities')
    .select('title, description, skills, deadline, source, apply_url')
    .eq('source', 'internshala')
    .not('description', 'is', null)
    .neq('description', '')
    .limit(1);
  if (intr && intr[0]) {
    const o = intr[0] as any;
    console.log(`Title: ${o.title}`);
    console.log(`URL: ${o.apply_url}`);
    console.log(`Desc length: ${(o.description||'').length} chars`);
    console.log(`Skills: [${(o.skills||[]).join(', ')}]`);
    console.log(`Deadline: ${o.deadline}`);
  }
}

run().catch(console.error);
