import { createClient } from '@supabase/supabase-js';
async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase.from('resumes').select('id, is_locked').limit(1);
  console.log(data, error);
}
run();
