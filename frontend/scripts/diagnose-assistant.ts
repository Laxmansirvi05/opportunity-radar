/**
 * AI Assistant — Database Diagnostics
 * Run: npx tsx scripts/diagnose-assistant.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function diagnose() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  AI ASSISTANT — DATABASE DIAGNOSTICS')
  console.log('═══════════════════════════════════════════\n')

  // 1. Check environment
  console.log('1. ENVIRONMENT')
  console.log(`   SUPABASE_URL:         ${SUPABASE_URL || '❌ MISSING'}`)
  console.log(`   SERVICE_ROLE_KEY:     ${SUPABASE_SERVICE_KEY ? '✅ SET (' + SUPABASE_SERVICE_KEY.substring(0, 10) + '...)' : '❌ MISSING'}`)
  console.log(`   ANON_KEY:             ${SUPABASE_ANON_KEY ? '✅ SET (' + SUPABASE_ANON_KEY.substring(0, 10) + '...)' : '❌ MISSING'}`)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\n❌ FATAL: Missing Supabase credentials. Cannot continue.')
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // 2. Check if tables exist
  console.log('\n2. TABLE EXISTENCE')

  const { data: convosCheck, error: convosErr } = await admin
    .from('chat_conversations')
    .select('id')
    .limit(0)

  console.log(`   chat_conversations:   ${convosErr ? '❌ DOES NOT EXIST' : '✅ EXISTS'}`)
  if (convosErr) {
    console.log(`     code:    ${convosErr.code}`)
    console.log(`     message: ${convosErr.message}`)
    console.log(`     details: ${convosErr.details}`)
    console.log(`     hint:    ${convosErr.hint}`)
  }

  const { data: msgsCheck, error: msgsErr } = await admin
    .from('chat_messages')
    .select('id')
    .limit(0)

  console.log(`   chat_messages:        ${msgsErr ? '❌ DOES NOT EXIST' : '✅ EXISTS'}`)
  if (msgsErr) {
    console.log(`     code:    ${msgsErr.code}`)
    console.log(`     message: ${msgsErr.message}`)
    console.log(`     details: ${msgsErr.details}`)
    console.log(`     hint:    ${msgsErr.hint}`)
  }

  if (convosErr || msgsErr) {
    console.log('\n⚠️  MIGRATION NOT APPLIED. Tables do not exist.')
    console.log('   Run the migration with one of:')
    console.log('     npx supabase migration up')
    console.log('     OR manually execute: supabase/migrations/20260807000000_ai_assistant_tables.sql')
    console.log('     OR run the SQL directly in the Supabase Dashboard SQL editor.\n')

    // 2b. Attempt to apply migration directly
    console.log('3. ATTEMPTING TO CREATE TABLES VIA SQL...\n')
    
    const createSQL = `
      -- Create chat_conversations table
      CREATE TABLE IF NOT EXISTS public.chat_conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL DEFAULT 'New Chat',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      -- Create chat_messages table
      CREATE TABLE IF NOT EXISTS public.chat_messages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          role TEXT CHECK (role IN ('user', 'ai')) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);

      -- Enable RLS
      ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

      -- RLS Policies for chat_conversations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'Users can insert their own conversations') THEN
          CREATE POLICY "Users can insert their own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'Users can view their own conversations') THEN
          CREATE POLICY "Users can view their own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'Users can update their own conversations') THEN
          CREATE POLICY "Users can update their own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'Users can delete their own conversations') THEN
          CREATE POLICY "Users can delete their own conversations" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;

      -- RLS Policies for chat_messages
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Users can insert their own messages') THEN
          CREATE POLICY "Users can insert their own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Users can view their own messages') THEN
          CREATE POLICY "Users can view their own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
        END IF;
      END $$;
    `

    const { error: sqlErr } = await admin.rpc('exec_sql', { sql: createSQL }).single()
    
    if (sqlErr) {
      // Try raw SQL via the REST API
      console.log('   RPC exec_sql not available. Trying pg REST...')
      
      // Use the pg module directly if available
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ sql: createSQL }),
        })
        
        if (!response.ok) {
          const errText = await response.text()
          console.log(`   ❌ Failed: ${response.status} — ${errText}`)
          console.log('\n   👉 You need to manually apply the migration.')
          console.log('   Copy the SQL from: supabase/migrations/20260807000000_ai_assistant_tables.sql')
          console.log('   Paste it into: Supabase Dashboard → SQL Editor → Run\n')
        } else {
          console.log('   ✅ Tables created successfully!')
        }
      } catch (e: any) {
        console.log(`   ❌ Network error: ${e.message}`)
        console.log('\n   👉 Manually apply the migration in the Supabase Dashboard SQL Editor.\n')
      }
    } else {
      console.log('   ✅ Tables created via exec_sql!')
    }

    // Re-check
    const { error: recheck1 } = await admin.from('chat_conversations').select('id').limit(0)
    const { error: recheck2 } = await admin.from('chat_messages').select('id').limit(0)
    
    if (recheck1 || recheck2) {
      console.log('\n❌ Tables still do not exist after attempted creation.')
      console.log('   Please manually run the migration SQL in your Supabase Dashboard.\n')
      process.exit(1)
    } else {
      console.log('\n✅ VERIFICATION: Both tables now exist!\n')
    }
  }

  // 3. Check column structure
  console.log('\n4. COLUMN VERIFICATION')

  const { data: testInsert, error: insertErr } = await admin
    .from('chat_conversations')
    .select('id, user_id, title, created_at, updated_at')
    .limit(1)

  if (insertErr) {
    console.log(`   ❌ Column check failed:`)
    console.log(`     code:    ${insertErr.code}`)
    console.log(`     message: ${insertErr.message}`)
    console.log(`     details: ${insertErr.details}`)
    console.log(`     hint:    ${insertErr.hint}`)
  } else {
    console.log('   ✅ chat_conversations columns: id, user_id, title, created_at, updated_at')
  }

  const { data: msgCols, error: msgColErr } = await admin
    .from('chat_messages')
    .select('id, conversation_id, user_id, role, content, created_at')
    .limit(1)

  if (msgColErr) {
    console.log(`   ❌ Column check failed:`)
    console.log(`     code:    ${msgColErr.code}`)
    console.log(`     message: ${msgColErr.message}`)
  } else {
    console.log('   ✅ chat_messages columns: id, conversation_id, user_id, role, content, created_at')
  }

  // 4. Check RLS policies
  console.log('\n5. RLS POLICY CHECK')

  const { data: policies, error: polErr } = await admin
    .rpc('get_policies_for_table', { table_name: 'chat_conversations' })

  if (polErr) {
    // Fallback: just test with anon key
    console.log('   (Cannot query pg_policies directly, testing access instead)')
    
    // Test anon access (should fail without auth)
    const { error: anonErr } = await anon.from('chat_conversations').select('id').limit(1)
    if (anonErr) {
      console.log(`   ✅ RLS is ACTIVE (anon access blocked: ${anonErr.code})`)
    } else {
      console.log('   ⚠️  RLS may not be active (anon access succeeded)')
    }
  } else {
    console.log(`   Policies: ${JSON.stringify(policies)}`)
  }

  // 5. Test admin INSERT + SELECT
  console.log('\n6. ADMIN INSERT/SELECT TEST')

  const testUserId = '00000000-0000-0000-0000-000000000000'
  
  const { data: adminInsert, error: adminInsertErr } = await admin
    .from('chat_conversations')
    .insert({ user_id: testUserId, title: '__DIAGNOSTIC_TEST__' })
    .select()
    .single()

  if (adminInsertErr) {
    console.log(`   ❌ Admin INSERT failed:`)
    console.log(`     code:    ${adminInsertErr.code}`)
    console.log(`     message: ${adminInsertErr.message}`)
    console.log(`     details: ${adminInsertErr.details}`)
    console.log(`     hint:    ${adminInsertErr.hint}`)
    
    if (adminInsertErr.code === '23503') {
      console.log(`\n   ROOT CAUSE: Foreign key violation.`)
      console.log(`   The user_id references auth.users(id), but no user with id '${testUserId}' exists.`)
      console.log(`   This is expected for the diagnostic test. Real users will work.`)
    }
  } else {
    console.log(`   ✅ Admin INSERT succeeded: id=${adminInsert.id}`)
    
    // Clean up
    await admin.from('chat_conversations').delete().eq('id', adminInsert.id)
    console.log('   ✅ Cleanup done')
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  DIAGNOSIS COMPLETE')
  console.log('═══════════════════════════════════════════\n')
}

diagnose().catch(console.error)
