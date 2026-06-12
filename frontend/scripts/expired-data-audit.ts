import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const NOW = new Date().toISOString();
const TODAY = new Date().toISOString().substring(0, 10);

async function main() {
  console.log(`Audit timestamp: ${NOW}\n`);

  // ── A1: Total records with past deadlines ──────────────────────────────────
  const { data: pastDeadline, count: pastDeadlineCount } = await db
    .from('opportunities')
    .select('id, title, company_name, source, deadline, status, created_at', { count: 'exact' })
    .not('deadline', 'is', null)
    .lt('deadline', NOW);

  console.log(`=== A1: RECORDS WITH PAST DEADLINES (any status) ===`);
  console.log(`Count: ${pastDeadlineCount}`);

  // ── A2: Published records with past deadlines (CRITICAL) ─────────────────
  const { data: publishedExpired, count: publishedExpiredCount } = await db
    .from('opportunities')
    .select('id, title, company_name, source, deadline, status, created_at', { count: 'exact' })
    .in('status', ['Published', 'Closing Soon'])
    .not('deadline', 'is', null)
    .lt('deadline', NOW);

  console.log(`\n=== A2: PUBLISHED/CLOSING-SOON WITH PAST DEADLINES (CRITICAL) ===`);
  console.log(`Count: ${publishedExpiredCount}`);
  (publishedExpired || []).slice(0, 30).forEach((o: any) => {
    console.log(`  [${o.status}] [${o.source}] [${o.deadline?.substring(0,10)}] "${o.title}" @ ${o.company_name?.split('\n')[0].trim().substring(0,40)} | ID: ${o.id}`);
  });

  // ── A3: Breakdown of past deadlines by YEAR ────────────────────────────────
  console.log(`\n=== A3: PAST DEADLINE YEAR BREAKDOWN ===`);
  const yearMap: Record<string, number> = {};
  (pastDeadline || []).forEach((o: any) => {
    const year = o.deadline?.substring(0, 4) ?? 'null';
    yearMap[year] = (yearMap[year] ?? 0) + 1;
  });
  Object.entries(yearMap).sort().forEach(([y, c]) => console.log(`  ${y}: ${c} records`));

  // ── A4: 2020-era records specifically ────────────────────────────────────
  const { data: year2020, count: year2020Count } = await db
    .from('opportunities')
    .select('id, title, company_name, source, deadline, status, created_at', { count: 'exact' })
    .gte('deadline', '2020-01-01T00:00:00Z')
    .lt('deadline', '2021-01-01T00:00:00Z');

  console.log(`\n=== A4: 2020-ERA RECORDS ===`);
  console.log(`Count: ${year2020Count}`);
  (year2020 || []).forEach((o: any) => {
    console.log(`  [${o.status}] [${o.source}] [${o.deadline?.substring(0,10)}] created:${o.created_at?.substring(0,10)} "${o.title}" @ ${o.company_name?.split('\n')[0].trim().substring(0,45)} | ID: ${o.id}`);
  });

  // ── A5: "Actively hiring" in company_name ─────────────────────────────────
  const { data: activelyHiring, count: activelyHiringCount } = await db
    .from('opportunities')
    .select('id, title, company_name, source, status, created_at', { count: 'exact' })
    .ilike('company_name', '%Actively hiring%');

  console.log(`\n=== A5: RECORDS WITH "Actively hiring" IN COMPANY_NAME ===`);
  console.log(`Count: ${activelyHiringCount}`);
  (activelyHiring || []).forEach((o: any) => {
    const cleanName = o.company_name?.split('\n')[0].trim().substring(0, 60);
    console.log(`  [${o.status}] [${o.source}] "${o.title}" | company_name raw starts with: [${cleanName}] | ID: ${o.id}`);
  });

  // ── A6: Are the "Actively hiring" records from seed data or ingestion? ─────
  console.log(`\n=== A6: ACTIVELY HIRING — SOURCE BREAKDOWN ===`);
  const sourceMap: Record<string, number> = {};
  (activelyHiring || []).forEach((o: any) => {
    sourceMap[o.source] = (sourceMap[o.source] ?? 0) + 1;
  });
  Object.entries(sourceMap).forEach(([s, c]) => console.log(`  ${s}: ${c} records`));

  // Were they inserted by the backfill? Check created_at vs updated_at
  console.log(`\n=== A6b: ACTIVELY HIRING — WERE THEY BACKFILLED? ===`);
  const { data: ahWithDates } = await db
    .from('opportunities')
    .select('id, company_name, created_at, updated_at')
    .ilike('company_name', '%Actively hiring%')
    .limit(10);
  (ahWithDates || []).forEach((o: any) => {
    const sameTime = o.created_at?.substring(0,19) === o.updated_at?.substring(0,19);
    console.log(`  created: ${o.created_at?.substring(0,19)} | updated: ${o.updated_at?.substring(0,19)} | same=${sameTime} | ${o.company_name?.split('\n')[0].trim().substring(0,40)}`);
  });

  // ── A7: 2020 records — were they from seed migrations? ────────────────────
  console.log(`\n=== A7: 2020 RECORDS — CREATION DATE (seed vs ingestion) ===`);
  (year2020 || []).slice(0, 20).forEach((o: any) => {
    const createdYear = o.created_at?.substring(0, 4);
    const origin = createdYear === '2020' ? 'likely SEED (created in 2020)' :
                   createdYear === '2026' ? 'INGESTION (created in 2026, wrong deadline parsed)' :
                   `created in ${createdYear}`;
    console.log(`  [${o.deadline?.substring(0,10)}] created:${o.created_at?.substring(0,10)} → ${origin} | "${o.title}" | ID: ${o.id}`);
  });

  // ── A8: Cross-reference: does the migration file have these IDs? ──────────
  // Check if any 2020-era records have IDs that appear in sequence (seeded data tends to have clustered UUIDs)
  console.log(`\n=== A8: 2020 RECORDS — STATUS BREAKDOWN ===`);
  const statusMap2020: Record<string, number> = {};
  (year2020 || []).forEach((o: any) => {
    statusMap2020[o.status] = (statusMap2020[o.status] ?? 0) + 1;
  });
  Object.entries(statusMap2020).forEach(([s, c]) => console.log(`  ${s}: ${c} records`));

  // ── A9: Source breakdown for past-deadline records ────────────────────────
  console.log(`\n=== A9: PAST DEADLINE BY SOURCE ===`);
  const srcMapPast: Record<string, number> = {};
  (pastDeadline || []).forEach((o: any) => {
    srcMapPast[o.source] = (srcMapPast[o.source] ?? 0) + 1;
  });
  Object.entries(srcMapPast).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c} records`));

  // ── A10: Are there any records that are Expired but show Published in UI? ──
  const { count: totalPublished } = await db
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon']);
    
  const { count: totalExpired } = await db
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Expired');

  console.log(`\n=== A10: STATUS OVERVIEW ===`);
  console.log(`  Published / Closing Soon: ${totalPublished}`);
  console.log(`  Expired: ${totalExpired}`);
  console.log(`  Published WITH past deadline: ${publishedExpiredCount} (THESE ARE THE PROBLEM)`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(55)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(55)}`);
  console.log(`  Total past-deadline records:            ${pastDeadlineCount}`);
  console.log(`  Published but deadline passed:          ${publishedExpiredCount}  ← CRITICAL`);
  console.log(`  2020-era deadlines:                     ${year2020Count}`);
  console.log(`  "Actively hiring" in company_name:      ${activelyHiringCount}  ← DATA QUALITY`);
}

main().catch(console.error);
