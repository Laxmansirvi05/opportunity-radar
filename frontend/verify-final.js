const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('frontend/.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx > 0) process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDb() {
  const { data: convs, error: e1 } = await admin.from('chat_conversations').select('count', { count: 'exact' });
  const { data: msgs, error: e2 } = await admin.from('chat_messages').select('count', { count: 'exact' });
  console.log('Conversations:', convs, e1);
  console.log('Messages:', msgs, e2);
}
checkDb().catch(console.error);
