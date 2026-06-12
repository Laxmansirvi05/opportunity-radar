/**
 * OPPORTUNITY RADAR — DEADLINE REPAIR SCRIPT
 *
 * For every Published Internshala record with a past deadline:
 *   1. Re-fetch the source detail page.
 *   2. Extract the real deadline.
 *   3. If future → set correct deadline + restore Published/Closing Soon.
 *   4. If past / unreachable → mark Expired.
 *
 * Preserves all IDs. Creates no duplicates.
 *
 * Run: npx tsx scripts/repair-deadlines.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 10_000;
const NOW = new Date();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Deadline parser (same fixed version as OpportunityNormalizer) ─────────────
function parseSafeDeadline(raw: string): Date | null {
  const str = raw.trim();
  if (!str || str.toLowerCase() === 'rolling') return null;

  // Handle Internshala apostrophe shorthand: "12 Jun '26" → "12 Jun 2026"
  const normalized = str
    .replace(/[\u2018\u2019']\s*(\d{2})(?=\s*$|\s)/g, '20$1')
    .replace(/[\u2018\u2019'](\d{2})/g, '20$1');

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;

  // Reject anything before 2024 — it's a parsing failure
  if (d.getFullYear() < 2024) {
    console.warn(`  ⚠️  Rejected suspect parse: "${str}" → ${d.toISOString().substring(0, 10)}`);
    return null;
  }

  return d;
}

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Extract deadline from Internshala detail page ─────────────────────────────
function extractDeadline(html: string): Date | null {
  const $ = cheerio.load(html);

  // Primary: .other_detail_item with "Apply by" / "Deadline" label
  let found: Date | null = null;
  $('.other_detail_item').each((_i, el) => {
    const label = $(el).find('.detail_title, .item_heading span').text().trim().toLowerCase();
    if (label.includes('apply by') || label.includes('deadline')) {
      const value = $(el).find('.detail_value, .item_body').text().trim();
      found = parseSafeDeadline(value);
    }
  });

  // Fallback: look for any date text after "Apply by" in the entire page text
  if (!found) {
    const pageText = $.text();
    const applyByMatch = pageText.match(/Apply\s+by\s+([A-Za-z0-9 ''\u2018\u2019]+\s*'\s*\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    if (applyByMatch) {
      found = parseSafeDeadline(applyByMatch[1]);
    }
  }

  return found;
}

// ── Determine correct status from deadline ────────────────────────────────────
function computeStatus(deadline: Date | null): 'Published' | 'Closing Soon' | 'Expired' {
  if (!deadline) return 'Expired'; // can't verify → safe default
  if (deadline < NOW) return 'Expired';
  const daysUntil = (deadline.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 7) return 'Closing Soon';
  return 'Published';
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface RepairStats {
  total: number;
  reactivated: number;
  closingSoon: number;
  expired: number;
  fetchFailed: number;
  noDeadlineOnPage: number;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   OPPORTUNITY RADAR — DEADLINE REPAIR SCRIPT            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  NOW: ${NOW.toISOString()}\n`);

  // ── 1. Query all bad records ────────────────────────────────────────────────
  const { data: badRecords, error } = await db
    .from('opportunities')
    .select('id, title, company_name, apply_url, deadline, status')
    .in('status', ['Published', 'Closing Soon'])
    .not('deadline', 'is', null)
    .lt('deadline', NOW.toISOString())
    .eq('source', 'internshala');

  if (error) { console.error('Query failed:', error.message); process.exit(1); }

  console.log(`Found ${badRecords?.length ?? 0} Published Internshala records with past deadlines.\n`);

  if (!badRecords || badRecords.length === 0) {
    console.log('✅ Nothing to repair.');
    return;
  }

  const stats: RepairStats = {
    total: badRecords.length,
    reactivated: 0,
    closingSoon: 0,
    expired: 0,
    fetchFailed: 0,
    noDeadlineOnPage: 0,
  };

  const reactivatedExamples: any[] = [];
  const expiredExamples: any[] = [];

  // ── 2. Process in batches ───────────────────────────────────────────────────
  for (let i = 0; i < badRecords.length; i += BATCH_SIZE) {
    const batch = badRecords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(badRecords.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches}:`);

    await Promise.all(batch.map(async (record: any) => {
      const companyShort = record.company_name?.split('\n')[0].trim().substring(0, 35) ?? '?';

      // 2a. Fetch detail page
      const html = await fetchPage(record.apply_url);
      if (!html) {
        console.log(`  ❌ FETCH FAILED  → Expired  | "${record.title}" @ ${companyShort}`);
        stats.fetchFailed++;
        stats.expired++;
        await db.from('opportunities').update({
          status: 'Expired',
          updated_at: new Date().toISOString(),
        }).eq('id', record.id);
        expiredExamples.push({ title: record.title, reason: 'fetch failed' });
        return;
      }

      // 2b. Extract real deadline
      const realDeadline = extractDeadline(html);

      if (!realDeadline) {
        // Page loaded but no deadline found → likely rolling or already closed
        console.log(`  ⚪ NO DEADLINE   → Expired  | "${record.title}" @ ${companyShort}`);
        stats.noDeadlineOnPage++;
        stats.expired++;
        await db.from('opportunities').update({
          status: 'Expired',
          deadline: null,
          updated_at: new Date().toISOString(),
        }).eq('id', record.id);
        expiredExamples.push({ title: record.title, reason: 'no deadline on page' });
        return;
      }

      // 2c. Compute correct status
      const newStatus = computeStatus(realDeadline);
      const deadlineISO = realDeadline.toISOString();

      if (newStatus === 'Expired') {
        console.log(`  🔴 EXPIRED       | deadline ${deadlineISO.substring(0, 10)} (past) | "${record.title}" @ ${companyShort}`);
        stats.expired++;
        expiredExamples.push({ title: record.title, deadline: deadlineISO.substring(0, 10) });
      } else if (newStatus === 'Closing Soon') {
        console.log(`  🟡 CLOSING SOON  | deadline ${deadlineISO.substring(0, 10)} | "${record.title}" @ ${companyShort}`);
        stats.closingSoon++;
        reactivatedExamples.push({ title: record.title, status: newStatus, deadline: deadlineISO.substring(0, 10) });
      } else {
        console.log(`  ✅ REACTIVATED   | deadline ${deadlineISO.substring(0, 10)} | "${record.title}" @ ${companyShort}`);
        stats.reactivated++;
        reactivatedExamples.push({ title: record.title, status: newStatus, deadline: deadlineISO.substring(0, 10) });
      }

      await db.from('opportunities').update({
        status: newStatus,
        deadline: deadlineISO,
        updated_at: new Date().toISOString(),
      }).eq('id', record.id);
    }));

    // Rate-limit between batches
    if (i + BATCH_SIZE < badRecords.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ── 3. Fix "Actively hiring" company name ──────────────────────────────────
  console.log('\n── Fixing "Actively hiring" company name contamination ──');
  const { data: ahRecords } = await db
    .from('opportunities')
    .select('id, company_name')
    .ilike('company_name', '%Actively hiring%');

  for (const r of (ahRecords ?? [])) {
    const cleanName = (r.company_name as string)
      .split('\n')[0]
      .replace(/\s+/g, ' ')
      .trim();
    const { error: updateErr } = await db.from('opportunities')
      .update({ company_name: cleanName, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (updateErr) {
      console.log(`  ❌ Failed to clean company_name for ${r.id}: ${updateErr.message}`);
    } else {
      console.log(`  ✅ Cleaned company_name: "${cleanName}" (ID: ${r.id})`);
    }
  }

  // ── 4. Verification report ─────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              REPAIR OPERATION RESULTS                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  Total records processed:  ${stats.total}`);
  console.log(`  Reactivated (Published):  ${stats.reactivated}`);
  console.log(`  Reactivated (Closing):    ${stats.closingSoon}`);
  console.log(`  Marked Expired:           ${stats.expired}`);
  console.log(`    └─ Fetch failed:        ${stats.fetchFailed}`);
  console.log(`    └─ No deadline on page: ${stats.noDeadlineOnPage}`);

  if (reactivatedExamples.length > 0) {
    console.log('\n  Sample reactivated opportunities:');
    reactivatedExamples.slice(0, 5).forEach(e =>
      console.log(`    [${e.status}] "${e.title}" → deadline: ${e.deadline}`)
    );
  }

  // ── 5. DB state after repair ───────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              POST-REPAIR VERIFICATION                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const nowStr = new Date().toISOString();

  const { count: totalPublished } = await db.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon']);

  const { count: totalExpiredStatus } = await db.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Expired');

  const { count: pubWithPastDeadline } = await db.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .not('deadline', 'is', null)
    .lt('deadline', nowStr);

  const { count: pub2020Deadline } = await db.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .gte('deadline', '2020-01-01T00:00:00Z')
    .lt('deadline', '2021-01-01T00:00:00Z');

  const { count: activelyHiringCount } = await db.from('opportunities')
    .select('*', { count: 'exact', head: true })
    .ilike('company_name', '%Actively hiring%');

  console.log(`  Total Published / Closing Soon:   ${totalPublished}`);
  console.log(`  Total Expired:                    ${totalExpiredStatus}`);
  console.log(`  Published with PAST deadline:     ${pubWithPastDeadline}  ${pubWithPastDeadline === 0 ? '✅ CLEAN' : '❌ STILL HAS ISSUES'}`);
  console.log(`  Published with 2020 deadline:     ${pub2020Deadline}  ${pub2020Deadline === 0 ? '✅ CLEAN' : '❌ STILL HAS ISSUES'}`);
  console.log(`  "Actively hiring" in company:     ${activelyHiringCount}  ${activelyHiringCount === 0 ? '✅ CLEAN' : '❌ STILL HAS ISSUES'}`);

  console.log('\n✅ Repair complete.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
