import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCleanup() {
  console.log("=== RUNNING DATA CLEANUP ===");
  const { data: opps, error } = await supabase.from('opportunities').select('id, title, description, deadline, companies(name)');
  
  if (!opps) return;

  const toDelete: string[] = [];
  const toUpdateDeadline: string[] = [];
  
  const oppMap = new Set();
  
  for (const o of opps) {
    // Duplicates
    const key = `${o.title}-${o.companies?.name}`;
    if (oppMap.has(key)) {
      toDelete.push(o.id);
      continue;
    }
    oppMap.add(key);

    // Low quality
    if (!o.description || o.description.length < 100) {
      toDelete.push(o.id);
      continue;
    }

    // Missing deadline
    if (!o.deadline) {
      toUpdateDeadline.push(o.id);
    }
  }

  console.log(`Found ${toDelete.length} records to delete (duplicates/low-quality).`);
  console.log(`Found ${toUpdateDeadline.length} records missing deadlines.`);

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('opportunities').delete().in('id', toDelete);
    if (delErr) console.error("Error deleting:", delErr);
    else console.log("Deleted successfully.");
  }

  if (toUpdateDeadline.length > 0) {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    
    // update in batches of 200
    for(let i = 0; i < toUpdateDeadline.length; i+=200) {
        const batch = toUpdateDeadline.slice(i, i+200);
        const { error: upErr } = await supabase.from('opportunities').update({ deadline: futureDate.toISOString() }).in('id', batch);
        if (upErr) console.error("Error updating deadlines:", upErr);
    }
    console.log("Updated deadlines successfully.");
  }
}

runCleanup().catch(console.error);
