import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== PHASE 1: DATA INTEGRITY ===");
  const { data: opps, error } = await supabase.from('opportunities').select('*, companies(name)');
  
  let duplicateOpps = 0;
  let emptyDesc = 0;
  let lowQualityDesc = 0;
  let missingLocation = 0;
  let missingCategory = 0;
  let missingDeadline = 0;
  let expiredVisible = 0;
  let emptySkills = 0;

  if (opps) {
    const oppMap = new Set();
    for (const o of opps) {
      const key = `${o.title}-${o.company_name || o.companies?.name}`;
      if (oppMap.has(key)) duplicateOpps++;
      else oppMap.add(key);

      if (!o.description || o.description.trim() === '') emptyDesc++;
      else if (o.description.length < 100) lowQualityDesc++;

      if (!o.location || o.location === 'N/A') missingLocation++;
      if (!o.category) missingCategory++;
      if (!o.deadline) missingDeadline++;
      if (!o.skills || o.skills.length === 0) emptySkills++;

      if (o.status === 'Published' && o.deadline && new Date(o.deadline) < new Date()) {
        expiredVisible++;
      }
    }
    console.log(`Total Opportunities: ${opps.length}`);
    console.log(`Duplicate Opportunities: ${duplicateOpps}`);
    console.log(`Empty Descriptions: ${emptyDesc}`);
    console.log(`Low Quality Descriptions (<100 chars): ${lowQualityDesc}`);
    console.log(`Empty/Null Skills: ${emptySkills}`);
    console.log(`Missing Location: ${missingLocation}`);
    console.log(`Missing Category: ${missingCategory}`);
    console.log(`Missing Deadline: ${missingDeadline}`);
    console.log(`Expired Visible: ${expiredVisible}`);
  }

  console.log("\n=== PHASE 2: COMPANY LOGOS ===");
  const { data: companies } = await supabase.from('companies').select('*');
  let missingLogos = 0;
  if (companies) {
    for (const c of companies) {
      if (!c.logo_url) missingLogos++;
    }
    console.log(`Total Companies: ${companies.length}`);
    console.log(`Missing Logos: ${missingLogos}`);
  }

  console.log("\n=== PHASE 6: SECURITY ===");
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')) {
    console.log('CRITICAL: Service role key is exposed to frontend!');
  } else {
    console.log('Service role key is securely hidden from frontend.');
  }

  // Check API cron routes protection
  const cronPaths = ['app/api/cron/refresh-unstop/route.ts'];
  for (const p of cronPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      if (content.includes('Bearer') || content.includes('authorization') || content.includes('API_SECRET')) {
        console.log(`${p} is protected via authorization header.`);
      } else {
        console.log(`WARNING: ${p} might not be protected!`);
      }
    }
  }
}

runAudit().catch(console.error);
