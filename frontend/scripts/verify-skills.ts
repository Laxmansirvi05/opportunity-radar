import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySkills() {
  const { data, error, count } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact' })
    .is('skills', null);

  if (error) {
    console.error('Error fetching count:', error);
  } else {
    console.log(`Missing skills (NULL) count: ${count}`);
  }
}

verifySkills().catch(console.error);
