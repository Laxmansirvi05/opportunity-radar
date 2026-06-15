import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Applying low-risk data fixes...");

  // 1. Clean garbage company names
  // We'll fetch all, clean them locally, and update only the changed ones.
  const { data: companies, error: cErr } = await db.from('companies').select('id, name');
  if (cErr) { console.error("Error fetching companies:", cErr); return; }
  
  let companyUpdates = 0;
  for (const c of companies) {
    let cleanName = c.name;
    // Remove "Actively hiring" and leading/trailing whitespace/newlines
    cleanName = cleanName.replace(/Actively hiring/i, '').trim();
    // Replace multiple spaces with single space
    cleanName = cleanName.replace(/\s{2,}/g, ' ');
    
    if (cleanName !== c.name) {
      const { error } = await db.from('companies').update({ name: cleanName }).eq('id', c.id);
      if (error) console.error("Failed to update company:", c.id, error.message);
      else companyUpdates++;
    }
  }
  console.log(`Cleaned ${companyUpdates} company names in 'companies' table.`);

  // Clean company_name in opportunities as well
  const { data: opps, error: oErr } = await db.from('opportunities').select('id, company_name');
  if (oErr) { console.error("Error fetching opps:", oErr); return; }

  let oppUpdates = 0;
  for (const o of opps) {
    if (!o.company_name) continue;
    let cleanName = o.company_name;
    cleanName = cleanName.replace(/Actively hiring/i, '').trim();
    cleanName = cleanName.replace(/\s{2,}/g, ' ');
    
    if (cleanName !== o.company_name) {
      const { error } = await db.from('opportunities').update({ company_name: cleanName }).eq('id', o.id);
      if (error) console.error("Failed to update opp company name:", o.id, error.message);
      else oppUpdates++;
    }
  }
  console.log(`Cleaned ${oppUpdates} company names in 'opportunities' table.`);

  // 2. Fix invalid deadlines (past but not expired)
  const now = new Date();
  const { data: invalidDeadlines, error: idErr } = await db.from('opportunities')
    .select('id, deadline, status')
    .neq('status', 'Expired')
    .not('deadline', 'is', null);
    
  if (idErr) { console.error("Error fetching deadlines:", idErr); return; }

  let deadlineUpdates = 0;
  for (const o of invalidDeadlines) {
    if (new Date(o.deadline) < now) {
      const { error } = await db.from('opportunities').update({ status: 'Expired' }).eq('id', o.id);
      if (error) console.error("Failed to expire opp:", o.id, error.message);
      else deadlineUpdates++;
    }
  }
  console.log(`Expired ${deadlineUpdates} opportunities with past deadlines.`);
  
  console.log("Fixes complete.");
}

run().catch(console.error);
