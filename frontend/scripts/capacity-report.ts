import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runReport() {
  // 1. Current active opportunities
  const { count: activeCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon']);
    
  // 2. Current active opportunities by provider
  const { data: providerData } = await supabase
    .from('opportunities')
    .select('source')
    .in('status', ['Published', 'Closing Soon']);
    
  const providerCounts = providerData?.reduce((acc: any, row) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {}) || {};

  // 3. Opportunities added in last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: last24Count } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);

  // 4 & 5. Latest status for Unstop and Internshala
  const { data: logs } = await supabase
    .from('ingestion_logs')
    .select('*')
    .in('provider', ['UnstopProvider', 'InternshalaProvider'])
    .order('created_at', { ascending: false })
    .limit(10);
    
  const unstopLog = logs?.find(l => l.provider === 'UnstopProvider');
  const internshalaLog = logs?.find(l => l.provider === 'InternshalaProvider');

  console.log(JSON.stringify({
    activeCount,
    providerCounts,
    last24Count,
    unstopLog,
    internshalaLog
  }, null, 2));
}

runReport();
