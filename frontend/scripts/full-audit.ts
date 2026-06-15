import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function fetchAll(table: string, select: string = '*') {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function run() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           COMPREHENSIVE DATABASE AUDIT                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Counts
  const { count: totalCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: activeCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  const { count: expiredCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Expired');
  const { count: publishedCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Published');
  const { count: closingSoonCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Closing Soon');

  console.log("=== 1. OPPORTUNITY COUNTS ===");
  console.log(`Total: ${totalCount}`);
  console.log(`Active (Published + Closing Soon): ${activeCount}`);
  console.log(`Published: ${publishedCount}`);
  console.log(`Closing Soon: ${closingSoonCount}`);
  console.log(`Expired: ${expiredCount}`);

  // 2. Fetch ALL opportunities for analysis
  const allOpps = await fetchAll('opportunities', 'id, title, company_name, apply_url, description, source, source_id, status, deadline, category, location, requirements');
  console.log(`\nFetched ${allOpps.length} records for analysis.\n`);

  // 3. Missing fields
  console.log("=== 2. MISSING FIELDS AUDIT ===");
  let missingTitle = 0, missingCompany = 0, missingUrl = 0, missingDesc = 0, missingCategory = 0;
  let emptyTitle = 0, emptyUrl = 0;

  for (const opp of allOpps) {
    if (!opp.title) missingTitle++;
    else if (opp.title.trim() === '') emptyTitle++;
    if (!opp.company_name) missingCompany++;
    if (!opp.apply_url) missingUrl++;
    else if (opp.apply_url.trim() === '') emptyUrl++;
    if (!opp.description || opp.description.trim().length < 10) missingDesc++;
    if (!opp.category) missingCategory++;
  }

  console.log(`Missing title: ${missingTitle}`);
  console.log(`Empty title: ${emptyTitle}`);
  console.log(`Missing company_name: ${missingCompany}`);
  console.log(`Missing apply_url: ${missingUrl}`);
  console.log(`Empty apply_url: ${emptyUrl}`);
  console.log(`Missing/short description (<10 chars): ${missingDesc}`);
  console.log(`Missing category: ${missingCategory}`);

  // 4. Invalid URLs
  console.log("\n=== 3. INVALID URLs AUDIT ===");
  let invalidUrls = 0;
  const invalidUrlExamples: string[] = [];
  for (const opp of allOpps) {
    if (opp.apply_url) {
      try {
        new URL(opp.apply_url);
      } catch {
        invalidUrls++;
        if (invalidUrlExamples.length < 5) invalidUrlExamples.push(`${opp.title}: ${opp.apply_url}`);
      }
    }
  }
  console.log(`Invalid URLs: ${invalidUrls}`);
  if (invalidUrlExamples.length > 0) {
    console.log("Examples:", invalidUrlExamples);
  }

  // 5. Duplicate detection
  console.log("\n=== 4. DUPLICATE DETECTION ===");
  // By source + source_id
  const sourceIdMap = new Map<string, number>();
  for (const opp of allOpps) {
    const key = `${opp.source}:${opp.source_id}`;
    sourceIdMap.set(key, (sourceIdMap.get(key) || 0) + 1);
  }
  const sourceIdDuplicates = [...sourceIdMap.entries()].filter(([, count]) => count > 1);
  console.log(`Duplicate source+source_id pairs: ${sourceIdDuplicates.length}`);
  if (sourceIdDuplicates.length > 0) {
    console.log("Top 5:", sourceIdDuplicates.slice(0, 5));
  }

  // By title + company (fingerprint duplicates)
  const fpMap = new Map<string, number>();
  for (const opp of allOpps) {
    const fp = `${(opp.company_name || '').toLowerCase().trim()}:${(opp.title || '').toLowerCase().trim()}`;
    fpMap.set(fp, (fpMap.get(fp) || 0) + 1);
  }
  const fpDuplicates = [...fpMap.entries()].filter(([, count]) => count > 1);
  console.log(`Duplicate title+company fingerprints: ${fpDuplicates.length}`);
  if (fpDuplicates.length > 0) {
    console.log("Top 10:", fpDuplicates.sort((a, b) => b[1] - a[1]).slice(0, 10));
  }

  // 6. Expired but showing as active
  console.log("\n=== 5. EXPIRY INTEGRITY AUDIT ===");
  const now = new Date();
  let expiredButActive = 0;
  const expiredButActiveExamples: string[] = [];
  for (const opp of allOpps) {
    if (opp.deadline && (opp.status === 'Published' || opp.status === 'Closing Soon')) {
      const deadlineDate = new Date(opp.deadline);
      if (deadlineDate < now) {
        expiredButActive++;
        if (expiredButActiveExamples.length < 5) {
          expiredButActiveExamples.push(`${opp.title} (deadline: ${opp.deadline}, status: ${opp.status})`);
        }
      }
    }
  }
  console.log(`Expired deadline but status is active: ${expiredButActive}`);
  if (expiredButActiveExamples.length > 0) {
    console.log("Examples:", expiredButActiveExamples);
  }

  // 7. Null deadlines
  let nullDeadlines = 0;
  for (const opp of allOpps) {
    if (!opp.deadline) nullDeadlines++;
  }
  console.log(`Opportunities with NULL deadline: ${nullDeadlines}`);

  // 8. Category distribution
  console.log("\n=== 6. CATEGORY DISTRIBUTION ===");
  const catMap = new Map<string, number>();
  for (const opp of allOpps) {
    catMap.set(opp.category || 'NULL', (catMap.get(opp.category || 'NULL') || 0) + 1);
  }
  for (const [cat, count] of [...catMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // 9. Status distribution
  console.log("\n=== 7. STATUS DISTRIBUTION ===");
  const statusMap = new Map<string, number>();
  for (const opp of allOpps) {
    statusMap.set(opp.status || 'NULL', (statusMap.get(opp.status || 'NULL') || 0) + 1);
  }
  for (const [status, count] of [...statusMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`);
  }

  // 10. Source distribution
  console.log("\n=== 8. SOURCE DISTRIBUTION ===");
  const srcMap = new Map<string, number>();
  for (const opp of allOpps) {
    srcMap.set(opp.source || 'NULL', (srcMap.get(opp.source || 'NULL') || 0) + 1);
  }
  for (const [src, count] of [...srcMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }

  // 11. Bookmark/Tracker/RecentlyViewed integrity
  console.log("\n=== 9. REFERENTIAL INTEGRITY ===");
  const { count: bookmarkCount } = await supabase.from('bookmarks').select('*', { count: 'exact', head: true });
  const { count: trackerCount } = await supabase.from('application_tracker').select('*', { count: 'exact', head: true });
  const { count: recentlyViewedCount } = await supabase.from('recently_viewed').select('*', { count: 'exact', head: true });
  console.log(`Bookmarks: ${bookmarkCount}`);
  console.log(`Application Tracker entries: ${trackerCount}`);
  console.log(`Recently Viewed entries: ${recentlyViewedCount}`);

  // 12. RLS policies check
  console.log("\n=== 10. RLS POLICIES ===");
  // We check by trying anon access
  const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  // Anon should be able to read opportunities  
  const { data: anonOpps, error: anonErr } = await anonSupabase.from('opportunities').select('id').limit(1);
  console.log(`Anon can read opportunities: ${!anonErr} (rows: ${anonOpps?.length})`);
  
  // Anon should NOT be able to write  
  const { error: anonWriteErr } = await anonSupabase.from('opportunities').insert({ title: 'TEST_INJECTION', company_name: 'HACKER' });
  console.log(`Anon write blocked: ${!!anonWriteErr} (${anonWriteErr?.code || 'no error?!'})`);

  // Anon should NOT be able to read bookmarks (RLS)
  const { data: anonBookmarks } = await anonSupabase.from('bookmarks').select('*');
  console.log(`Anon bookmarks read (should be 0): ${anonBookmarks?.length}`);

  // Anon should NOT be able to read tracker
  const { data: anonTracker } = await anonSupabase.from('application_tracker').select('*');
  console.log(`Anon tracker read (should be 0): ${anonTracker?.length}`);

  // Anon should NOT be able to read profiles
  const { data: anonProfiles } = await anonSupabase.from('profiles').select('*');
  console.log(`Anon profiles read (should be 0): ${anonProfiles?.length}`);

  // Anon should NOT be able to read recently_viewed
  const { data: anonRecent } = await anonSupabase.from('recently_viewed').select('*');
  console.log(`Anon recently_viewed read (should be 0): ${anonRecent?.length}`);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║           AUDIT COMPLETE                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

run().catch(console.error);
