const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx > 0) process.env[line.substring(0, idx).trim()] = line.substring(idx+1).trim();
  }
});
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFlow() {
  console.log('Testing End-to-End Chat Flow...');
  const email = 'chatuser' + Date.now() + '@example.com';
  const { data: userAuth, error: authErr } = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
  if (authErr) return console.error('Auth error:', authErr);
  const user = userAuth.user;

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: sessionData } = await client.auth.signInWithPassword({ email, password: 'password123' });
  const token = sessionData.session.access_token;
  const refreshToken = sessionData.session.refresh_token;

  // Simulate cookie-based authentication
  const cookie = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token=${encodeURIComponent(JSON.stringify([token, refreshToken, null, null, null]))}`;

  console.log('1. Send message to create conversation automatically...');
  const res = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello AI' }] })
  });
  console.log('API Status:', res.status);
  
  if (!res.ok) {
     console.log('Error:', await res.text());
  } else {
     const data = await res.json();
     console.log('AI Response:', data.text.substring(0, 50) + '...');
  }

  console.log('2. Check database for conversation and messages...');
  const { data: convs } = await admin.from('chat_conversations').select('*').eq('user_id', user.id);
  console.log('Conversations count:', convs.length);

  // But wait, the API route does NOT create the conversation! The frontend creates it and passes conversationId!
  // Let me check if my script passed conversationId. No, I didn't. Does the API create it? No, the frontend creates it.
  
  await admin.auth.admin.deleteUser(user.id);
  console.log('Cleanup done.');
}
testFlow().catch(console.error);
