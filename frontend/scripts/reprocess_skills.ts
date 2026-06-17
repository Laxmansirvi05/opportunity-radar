import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { SkillExtractor } from '../src/providers/opportunities/utils/SkillExtractor';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  console.log("Starting skills reprocessing...");
  
  const { data: beforeData, error: beforeErr } = await supabase
    .from('opportunities')
    .select('id, description')
    .filter('skills', 'eq', '[]');
    
  if (beforeErr) {
    console.error("Error fetching before:", beforeErr);
    return;
  }
  
  console.log(`Before count: ${beforeData?.length || 0} empty skills`);
  
  if (!beforeData || beforeData.length === 0) return;
  
  let fixedCount = 0;
  for (const item of beforeData) {
    if (!item.description) continue;
    
    const extractedSkills = SkillExtractor.extract(item.description);
    if (extractedSkills.length > 0) {
      await supabase
        .from('opportunities')
        .update({ skills: extractedSkills })
        .eq('id', item.id);
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} opportunities.`);
  
  const { count: afterCount, error: afterErr } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .filter('skills', 'eq', '[]');
    
  console.log(`After count: ${afterCount} empty skills`);
}

run();
