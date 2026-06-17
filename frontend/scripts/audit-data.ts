import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runDataAudit() {
  console.log("--- Starting Data Integrity Audit ---");
  
  const { data: allOpps, error } = await supabase.from('opportunities').select('id, title, description, requirements, location, category, apply_url, status');
  
  if (error || !allOpps) {
    console.error("Failed to fetch opportunities", error);
    return;
  }
  
  console.log(`Total Opportunities: ${allOpps.length}`);
  
  let missingDesc = 0;
  let missingSkills = 0;
  let missingLocation = 0;
  let missingCategory = 0;
  let missingApplyUrl = 0;
  let brokenLinks = 0; // We'd need to fetch them to know for sure, we'll check URL structure instead for now
  
  for (const opp of allOpps) {
    if (!opp.description || opp.description.trim() === '') missingDesc++;
    if (!opp.requirements || opp.requirements.length === 0) missingSkills++;
    if (!opp.location || opp.location.trim() === '' || opp.location === 'N/A') missingLocation++;
    if (!opp.category || opp.category.trim() === '') missingCategory++;
    if (!opp.apply_url || opp.apply_url.trim() === '') {
      missingApplyUrl++;
    } else {
      try {
        new URL(opp.apply_url);
      } catch {
        brokenLinks++;
      }
    }
  }

  console.log(`Missing Descriptions: ${missingDesc}`);
  console.log(`Missing Skills: ${missingSkills}`);
  console.log(`Missing Locations: ${missingLocation}`);
  console.log(`Missing Categories: ${missingCategory}`);
  console.log(`Missing Apply URLs: ${missingApplyUrl}`);
  console.log(`Invalid Apply URLs (Format): ${brokenLinks}`);

  // Find duplicates across titles/companies
  const { data: dupCheck } = await supabase.from('opportunities').select('title, company_name');
  const counts = new Map();
  let duplicates = 0;
  if (dupCheck) {
    for (const d of dupCheck) {
      const key = `${d.title}::${d.company_name}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const [key, val] of counts.entries()) {
      if (val > 1) duplicates += (val - 1);
    }
  }
  console.log(`Identical Title/Company Duplicates: ${duplicates}`);
}

runDataAudit();
