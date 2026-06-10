import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_u-kGLYM5RkJE4IECpRix0Q_PvTlBbCm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from('opportunities').insert({
    title: 'Test YC Validation',
    apply_url: 'https://google.com',
    category: 'Job',
    status: 'Published', // will probably fail RLS
    source_type: 'ycombinator',
    posted_at: new Date().toISOString()
  });
  console.log('Insert response:', { data, error });
}
testInsert();
