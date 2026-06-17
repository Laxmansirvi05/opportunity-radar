import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// We must dynamically import the function since it's a ts file
async function test() {
  const { searchOpportunities } = await import('../features/opportunities/services/opportunity-service');
  
  const keywords = ['amazon', 'python', 'frontend', 'software', 'ai', 'machine learning', 'remote'];
  
  for (const q of keywords) {
    const start = Date.now();
    try {
      const res = await searchOpportunities(supabase as any, { q });
      const ms = Date.now() - start;
      console.log(`[OK] Search "${q}": ${res.count} results in ${ms}ms`);
    } catch (e: any) {
      console.error(`[ERROR] Search "${q}":`, e.message);
    }
  }
}
test().catch(console.error);
