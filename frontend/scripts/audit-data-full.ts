import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runFullDataAudit() {
  console.log("--- Starting Full Data Integrity Audit ---");
  
  let allOpps: any[] = [];
  let from = 0;
  let to = 999;
  
  while (true) {
    const { data, error } = await supabase.from('opportunities').select('id, title, description, skills, location, category, apply_url, status').range(from, to);
    if (error) {
      console.error("Failed to fetch opportunities", error);
      return;
    }
    if (!data || data.length === 0) break;
    allOpps.push(...data);
    from += 1000;
    to += 1000;
  }
  
  console.log(`Total Opportunities Fetched: ${allOpps.length}`);
  
  let missingDesc = 0;
  let missingSkills = 0;
  let missingLocation = 0;
  let missingCategory = 0;
  let missingApplyUrl = 0;
  let brokenLinks = 0; 
  let duplicateRecords = 0;

  for (const opp of allOpps) {
    if (!opp.description || opp.description.trim() === '') missingDesc++;
    if (!opp.skills || opp.skills.length === 0) missingSkills++;
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
}

runFullDataAudit();
