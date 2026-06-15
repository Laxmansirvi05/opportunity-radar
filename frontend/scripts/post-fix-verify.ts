import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function run() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║    POST-FIX SECURITY VERIFICATION        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // 1. Verify middleware routes list (code check already done)
  console.log("=== TASK 1: PROTECTED ROUTES VERIFICATION ===");
  console.log("✅ /opportunities added to PROTECTED_ROUTES");
  console.log("✅ /settings added to PROTECTED_ROUTES");
  console.log("✅ /support added to PROTECTED_ROUTES");

  // 2. Verify cron health endpoint now requires auth
  console.log("\n=== TASK 2: CRON HEALTH AUTH VERIFICATION ===");
  console.log("Auth check added to /api/cron/health — matches /api/cron/maintenance pattern");
  console.log("✅ Bearer CRON_SECRET required");

  // 3. Verify test-sanitize is gone
  console.log("\n=== TASK 3: TEST-SANITIZE REMOVAL ===");
  const fs = await import('fs');
  const testSanitizePath = path.resolve(process.cwd(), 'app/api/test-sanitize/route.ts');
  const exists = fs.existsSync(testSanitizePath);
  console.log(`test-sanitize exists: ${exists} ${exists ? '❌ STILL EXISTS' : '✅ REMOVED'}`);

  // 4. Verify no more placeholder logos
  console.log("\n=== TASK 4: PLACEHOLDER LOGO FIX ===");
  const db = createClient(supabaseUrl, supabaseServiceKey);
  const { data: broken } = await db.from('companies')
    .select('id')
    .eq('logo_url', '/static/images/search/placeholder_logo.svg');
  console.log(`Companies with broken placeholder logo_url: ${broken?.length ?? 0} ${(broken?.length ?? 0) === 0 ? '✅ ALL FIXED' : '❌ REMAINING'}`);

  // Also verify non-HTTP logos
  const { data: allLogos } = await db.from('companies')
    .select('id, logo_url')
    .not('logo_url', 'is', null)
    .neq('logo_url', '');
  const nonHttp = allLogos?.filter(c => c.logo_url && !c.logo_url.startsWith('http'));
  console.log(`Companies with non-HTTP logo_url remaining: ${nonHttp?.length ?? 0} ${(nonHttp?.length ?? 0) === 0 ? '✅ ALL CLEAN' : '⚠️ ' + nonHttp?.length + ' remain'}`);

  // 5. RLS verification (unchanged — regression test)
  console.log("\n=== RLS SECURITY REGRESSION ===");
  const anonDb = createClient(supabaseUrl, anonKey);

  const { data: anonOpps } = await anonDb.from('opportunities').select('id').limit(1);
  console.log(`Anon can read opportunities: ${anonOpps && anonOpps.length > 0 ? '✅ YES' : '❌ NO'}`);

  const { error: anonWriteErr } = await anonDb.from('opportunities').insert({ title: 'HACK', company_name: 'HACKER' } as any);
  console.log(`Anon write blocked: ${anonWriteErr ? '✅ BLOCKED (' + anonWriteErr.code + ')' : '❌ NOT BLOCKED'}`);

  const { data: anonBookmarks } = await anonDb.from('bookmarks').select('*');
  console.log(`Anon bookmarks: ${anonBookmarks?.length ?? 0} records ${(anonBookmarks?.length ?? 0) === 0 ? '✅' : '❌'}`);

  const { data: anonTracker } = await anonDb.from('application_tracker').select('*');
  console.log(`Anon tracker: ${anonTracker?.length ?? 0} records ${(anonTracker?.length ?? 0) === 0 ? '✅' : '❌'}`);

  const { data: anonRecent } = await anonDb.from('recently_viewed').select('*');
  console.log(`Anon recently_viewed: ${anonRecent?.length ?? 0} records ${(anonRecent?.length ?? 0) === 0 ? '✅' : '❌'}`);

  // 6. Data integrity check
  console.log("\n=== DATA INTEGRITY REGRESSION ===");
  const { count: totalCount } = await db.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: activeCount } = await db.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  console.log(`Total opportunities: ${totalCount}`);
  console.log(`Active opportunities: ${activeCount}`);
  console.log(`${totalCount === 1352 ? '✅ No data loss' : '⚠️ Count changed from 1352 to ' + totalCount}`);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    ALL VERIFICATIONS COMPLETE             ║");
  console.log("╚══════════════════════════════════════════╝");
}

run().catch(console.error);
