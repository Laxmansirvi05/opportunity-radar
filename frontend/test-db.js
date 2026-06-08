require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing columns existence...");
  const { data, error } = await supabase.from('profiles').select('email_alerts, public_profile').limit(1);
  if (error) {
    console.error("Columns test failed:", error);
  } else {
    console.log("Columns exist! Data:", data);
  }
}

test();
