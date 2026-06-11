import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runMetrics() {
  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const sqlContent = fs.readFileSync(path.join(process.cwd(), 'final_cleanup.sql'), 'utf-8');
  const deletedIds = new Set();
  
  let weakDesc = 0;
  let brokenLink = 0;
  let duplicate = 0;
  let missingUrl = 0;
  let demo = 0;
  let expired = 0;

  const lines = sqlContent.split('\n');
  for (const line of lines) {
    if (line.includes('DELETE FROM')) {
      const match = line.match(/id = '([^']+)'/);
      if (match) deletedIds.add(match[1]);
      
      if (line.includes('Weak description')) weakDesc++;
      else if (line.includes('Broken link')) brokenLink++;
      else if (line.includes('Duplicate')) duplicate++;
      else if (line.includes('Missing URL')) missingUrl++;
      else if (line.includes('Demo')) demo++;
      else if (line.includes('Expired')) expired++;
    }
  }

  const initialTotal = opportunities.length;
  const remainingOpportunities = opportunities.filter(o => !deletedIds.has(o.id));
  const finalTotal = remainingOpportunities.length;

  let missingCompany = 0;
  let missingSkills = 0;
  let missingDescription = 0;
  let finalMissingUrl = 0;

  for (const opp of remainingOpportunities) {
    if (!opp.company_id) missingCompany++;
    if (!opp.description || opp.description.trim() === '') missingDescription++;
    if (!opp.skills || !Array.isArray(opp.skills) || opp.skills.length === 0) missingSkills++;
    if (!opp.apply_url || opp.apply_url.trim() === '') finalMissingUrl++;
  }

  console.log(`Total opportunities before cleanup: ${initialTotal}`);
  console.log();
  console.log(`Broken links removed: ${brokenLink}`);
  console.log(`Expired opportunities removed: ${expired}`);
  console.log(`Duplicate opportunities removed: ${duplicate}`);
  console.log(`Demo records removed: ${demo}`);
  console.log(`Weak descriptions removed: ${weakDesc}`);
  console.log(`Missing URLs removed: ${missingUrl}`);
  console.log();
  console.log(`Total opportunities after cleanup: ${finalTotal}`);
  console.log();
  console.log(`Remaining records with:`);
  console.log(`- Missing company: ${missingCompany}`);
  console.log(`- Missing skills: ${missingSkills}`); // Assuming it's 120 because the column isn't created/populated yet
  console.log(`- Missing description: ${missingDescription}`);
  console.log(`- Missing URL: ${finalMissingUrl}`);
}

runMetrics();
