import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fixDataIntegrity() {
  console.log("--- Starting Data Integrity Fix ---");
  
  // Find all opportunities where skills is null
  let allOpps: any[] = [];
  let from = 0;
  let to = 999;
  
  while (true) {
    const { data, error } = await supabase.from('opportunities').select('id, skills').is('skills', null).range(from, to);
    if (error) {
      console.error("Failed to fetch opportunities", error);
      return;
    }
    if (!data || data.length === 0) break;
    allOpps.push(...data);
    from += 1000;
    to += 1000;
  }
  
  console.log(`Found ${allOpps.length} opportunities with missing skills.`);
  
  if (allOpps.length > 0) {
    console.log("Fixing...");
    // Batch update
    const batchSize = 200;
    let fixed = 0;
    
    for (let i = 0; i < allOpps.length; i += batchSize) {
      const batchIds = allOpps.slice(i, i + batchSize).map(o => o.id);
      const { error } = await supabase.from('opportunities').update({ skills: [] }).in('id', batchIds);
      if (error) {
        console.error("Failed to update batch", error);
      } else {
        fixed += batchIds.length;
        console.log(`Fixed ${fixed}/${allOpps.length}...`);
      }
    }
    console.log(`Successfully fixed ${fixed} records.`);
  } else {
    console.log("No records need fixing.");
  }
}

fixDataIntegrity();
