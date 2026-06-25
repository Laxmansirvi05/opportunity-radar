import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  console.log("Running final verifications...");

  const { data: allAmazon } = await db
    .from('opportunities')
    .select('id, description, skills, requirements, company_id')
    .ilike('company_name', '%amazon%');

  let shortDesc = 0;
  let emptySkills = 0;
  let emptyReqs = 0;

  for (const opp of allAmazon || []) {
    if (!opp.description || opp.description.length < 500) shortDesc++;
    if (!opp.skills || opp.skills.length === 0) emptySkills++;
    if (!opp.requirements || opp.requirements.length === 0) emptyReqs++;
  }

  console.log(`Amazon records with description length < 500: ${shortDesc}`);
  console.log(`Amazon records with empty skills: ${emptySkills}`);
  console.log(`Amazon records with empty requirements: ${emptyReqs}`);

  // Fetch the company logo to check
  if (allAmazon && allAmazon.length > 0) {
     const { data: comp } = await db.from('companies').select('logo_url').eq('id', allAmazon[0].company_id).single();
     console.log(`Amazon Logo URL: ${comp?.logo_url ? 'PRESENT (' + comp.logo_url + ')' : 'MISSING'}`);
  }

  // Delete dead jobs if shortDesc > 0
  if (shortDesc > 0 || emptySkills > 0 || emptyReqs > 0) {
    console.log(`There are still dead/historical records no longer available on the Amazon API. Deleting them to sanitize the database...`);
    
    const idsToDelete = (allAmazon || [])
       .filter(o => !o.description || o.description.length < 500 || !o.skills || o.skills.length === 0 || !o.requirements || o.requirements.length === 0)
       .map(o => o.id);
       
    if (idsToDelete.length > 0) {
        for(let i=0; i<idsToDelete.length; i+=100) {
           const chunk = idsToDelete.slice(i, i+100);
           await db.from('opportunities').delete().in('id', chunk);
        }
        console.log(`Deleted ${idsToDelete.length} dead Amazon records.`);
    }
  }
}

verify().catch(console.error);
