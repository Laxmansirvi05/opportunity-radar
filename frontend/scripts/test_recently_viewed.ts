import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
  console.log("=== Testing recently_viewed RLS ===");

  // 1. Create a mock user
  const email = `testuser_${Date.now()}@example.com`;
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  });

  if (authError) throw authError;
  const user = authData.user;
  console.log(`Created test user: ${user.id}`);

  // Create profile for user
  await adminClient.from('profiles').insert({
    id: user.id,
    first_name: 'Test',
    last_name: 'User',
    email: email,
    role: 'Student'
  });

  // Get a random opportunity
  const { data: opps } = await adminClient.from('opportunities').select('id').limit(1);
  const oppId = opps![0].id;
  console.log(`Using opportunity: ${oppId}`);

  // 2. Sign in as user
  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  await userClient.auth.signInWithPassword({ email, password: 'password123' });

  // 3. Test Insert
  console.log("Testing INSERT...");
  const { data: insertData, error: insertError } = await userClient
    .from('recently_viewed')
    .insert({ user_id: user.id, opportunity_id: oppId })
    .select()
    .single();
  
  if (insertError) {
    console.error("INSERT FAILED:", insertError);
  } else {
    console.log("INSERT SUCCESS");
  }

  // 4. Test Update
  console.log("Testing UPDATE...");
  const { data: updateData, error: updateError } = await userClient
    .from('recently_viewed')
    .update({ viewed_at: new Date().toISOString() })
    .eq('opportunity_id', oppId)
    .select()
    .single();

  if (updateError) {
    console.error("UPDATE FAILED:", updateError);
  } else {
    console.log("UPDATE SUCCESS");
  }

  // 5. Test Read
  console.log("Testing READ...");
  const { data: readData, error: readError } = await userClient
    .from('recently_viewed')
    .select('*')
    .eq('user_id', user.id);

  if (readError) {
    console.error("READ FAILED:", readError);
  } else {
    console.log(`READ SUCCESS (Found ${readData.length} records)`);
  }

  // 6. Test RLS protection (Anon Read)
  console.log("Testing ANON READ (Should be 0 records or fail)...");
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: anonData, error: anonError } = await anonClient
    .from('recently_viewed')
    .select('*');
  
  if (anonError) {
    console.error("ANON READ FAILED (Expected if no select grant, but we gave it):", anonError);
  } else {
    console.log(`ANON READ SUCCESS (Found ${anonData.length} records - should be 0 due to RLS)`);
  }

  // Cleanup
  await adminClient.auth.admin.deleteUser(user.id);
  console.log("Test user cleaned up.");
}

runTest().catch(console.error);
