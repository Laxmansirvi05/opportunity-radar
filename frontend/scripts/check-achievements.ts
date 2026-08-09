import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAchievements() {
  const { data, error } = await supabase.from('achievements').select('*').limit(1);
  if (error) {
    console.log('Error or table does not exist:', error);
  } else {
    console.log('Table exists, sample data:', data);
  }
}

checkAchievements();
