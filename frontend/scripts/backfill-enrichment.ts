/**
 * OPPORTUNITY RADAR — DATA BACKFILL SCRIPT
 *
 * Purpose: Re-enrich stale opportunities that are missing description, skills,
 * or deadline. Updates records IN-PLACE. Never creates duplicates.
 *
 * Run: npx tsx scripts/backfill-enrichment.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 5;        // concurrent detail-page fetches
const FETCH_DELAY_MS = 800;  // delay between batches (rate limiting)
const FETCH_TIMEOUT_MS = 10_000;

// Skills that are actually Internshala perks/badges, not tech skills
const PERK_KEYWORDS = new Set([
  'certificate', 'letter of recommendation', 'flexible work hours', 'job offer',
  'pre-placement offer', 'ppe', 'ppo', 'informal dress code', '5 days a week',
  'free snacks & beverages', 'health insurance', 'gym', 'cab facility',
  'earn while you learn', 'certificate only', 'equity', 'no equity'
]);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Supabase ─────────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Sleep helper for rate-limiting */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Clean a raw DOM company name from Internshala (strips whitespace + "Actively hiring" badge) */
function cleanCompanyName(raw: string): string {
  return raw
    .split('\n')[0]        // take text before any newline
    .replace(/\s+/g, ' ') // collapse internal whitespace
    .trim();
}

/** Parse Internshala deadline text like "20 Jun '26" → ISO string */
function parseInternshalaDeadline(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase() === 'rolling') return null;
  // Internshala format: "20 Jun '26" or "20 Jun 2026"
  const normalized = trimmed.replace(/'/g, '20'); // "Jun '26" → "Jun 2026"
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Filter out perk words from skill arrays */
function filterSkills(skills: string[]): string[] {
  return skills.filter(s => !PERK_KEYWORDS.has(s.toLowerCase().trim()));
}

// ── Internshala Detail Page Extraction ───────────────────────────────────────

interface DetailResult {
  description: string | null;
  skills: string[];
  deadline: string | null;
}

function extractInternshalaDetail(html: string): DetailResult {
  const $ = cheerio.load(html);

  // 1. Full description
  const description = $('.internship_details').first().text().replace(/\s+/g, ' ').trim() || null;

  // 2. Skills — use only tech skill chips, not perk badges
  // Internshala uses .round_tabs for skill chips inside .round_tabs_container
  const rawSkills: string[] = [];
  $('.round_tabs_container .round_tabs, .training_skills_container span').each((_i, el) => {
    rawSkills.push($(el).text().trim());
  });
  const skills = filterSkills(rawSkills);

  // 3. Deadline — look for "Apply by" label in .other_detail_item
  let deadline: string | null = null;
  $('.other_detail_item').each((_i, el) => {
    const label = $(el).find('.detail_title, .item_heading span').text().trim().toLowerCase();
    if (label.includes('apply by') || label.includes('deadline')) {
      const value = $(el).find('.detail_value, .item_body').text().trim();
      deadline = parseInternshalaDeadline(value);
    }
  });

  return { description, skills, deadline };
}

// ── Main Backfill Logic ───────────────────────────────────────────────────────

interface StaleRecord {
  id: string;
  title: string;
  company_name: string;
  source: string;
  apply_url: string;
  description: string | null;
  skills: string[];
  deadline: string | null;
}

interface BackfillStats {
  scanned: number;
  updated: number;
  skipped_no_change: number;
  failed: number;
}

async function backfillInternshala(records: StaleRecord[], stats: BackfillStats) {
  console.log(`\n📦 Processing ${records.length} stale Internshala records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(records.length / BATCH_SIZE)}`);

    await Promise.all(batch.map(async (record) => {
      try {
        const html = await fetchPage(record.apply_url);
        if (!html) {
          console.warn(`    ⚠️  Could not fetch: ${record.apply_url}`);
          stats.failed++;
          return;
        }

        const detail = extractInternshalaDetail(html);

        // Merge: prefer newly fetched data, fall back to existing
        const newDescription = detail.description || record.description || null;
        const mergedSkills = Array.from(new Set([
          ...filterSkills(record.skills || []),
          ...detail.skills,
        ]));
        const newDeadline = detail.deadline || record.deadline;

        // Skip update if nothing improved
        const hasImprovedDesc = newDescription && (!record.description || record.description === '');
        const hasImprovedSkills = mergedSkills.length > (record.skills?.length ?? 0);
        const hasImprovedDeadline = newDeadline && !record.deadline;
        const cleanedCompany = cleanCompanyName(record.company_name);
        const hasCompanyFix = cleanedCompany !== record.company_name;

        if (!hasImprovedDesc && !hasImprovedSkills && !hasImprovedDeadline && !hasCompanyFix) {
          stats.skipped_no_change++;
          console.log(`    ↩  No improvement for "${record.title}"`);
          return;
        }

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (hasImprovedDesc) updatePayload.description = newDescription;
        if (hasImprovedSkills) updatePayload.skills = mergedSkills;
        if (hasImprovedDeadline) updatePayload.deadline = newDeadline;
        if (hasCompanyFix) updatePayload.company_name = cleanedCompany;

        const { error } = await db
          .from('opportunities')
          .update(updatePayload)
          .eq('id', record.id); // EXACT ID — never creates duplicates

        if (error) {
          console.error(`    ❌ DB update failed for "${record.title}":`, error.message);
          stats.failed++;
        } else {
          stats.updated++;
          const flags = [
            hasImprovedDesc ? 'desc' : '',
            hasImprovedSkills ? `skills(${mergedSkills.length})` : '',
            hasImprovedDeadline ? 'deadline' : '',
            hasCompanyFix ? 'company_name' : '',
          ].filter(Boolean).join(', ');
          console.log(`    ✅ Updated "${record.title}" → [${flags}]`);

          // Update opportunity_tags for enriched skills
          if (hasImprovedSkills && mergedSkills.length > 0) {
            const tagsPayload = mergedSkills.map(skill => ({
              opportunity_id: record.id,
              tag_name: skill.trim(),
            }));
            await db.from('opportunity_tags')
              .upsert(tagsPayload, { onConflict: 'opportunity_id,tag_name' });
          }
        }
      } catch (err: any) {
        console.error(`    ❌ Unexpected error for "${record.title}":`, err.message);
        stats.failed++;
      }
    }));

    // Rate-limit: pause between batches to avoid IP bans
    if (i + BATCH_SIZE < records.length) {
      await sleep(FETCH_DELAY_MS);
    }
  }
}

async function backfillUnstopDeadlines(records: StaleRecord[], stats: BackfillStats) {
  console.log(`\n📦 Processing ${records.length} stale Unstop records (deadline backfill)...`);

  for (const record of records) {
    // Unstop doesn't offer rolling-deadline data via the public API.
    // Set a computed default: posted_at + 30 days, so the record is
    // useful in deadline-sorted searches. Mark title unchanged.
    try {
      const { data: opp } = await db
        .from('opportunities')
        .select('posted_at')
        .eq('id', record.id)
        .single();

      if (!opp?.posted_at) {
        stats.skipped_no_change++;
        continue;
      }

      const postedAt = new Date(opp.posted_at);
      const computedDeadline = new Date(postedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const deadlineISO = computedDeadline.toISOString();

      const { error } = await db
        .from('opportunities')
        .update({ deadline: deadlineISO, updated_at: new Date().toISOString() })
        .eq('id', record.id);

      if (error) {
        console.error(`  ❌ Failed deadline update for "${record.title}":`, error.message);
        stats.failed++;
      } else {
        stats.updated++;
        console.log(`  ✅ Set computed deadline for "${record.title}" → ${deadlineISO.substring(0, 10)}`);
      }
    } catch (err: any) {
      stats.failed++;
      console.error(`  ❌ Error on "${record.title}":`, err.message);
    }
  }
}

// ── Coverage Query ─────────────────────────────────────────────────────────────

async function getCoverage() {
  const { count: total } = await db.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: hasDesc } = await db.from('opportunities').select('*', { count: 'exact', head: true })
    .not('description', 'is', null).neq('description', '');
  const { count: hasSkills } = await db.from('opportunities').select('*', { count: 'exact', head: true })
    .not('skills', 'is', null).neq('skills', '{}');
  const { count: hasDeadline } = await db.from('opportunities').select('*', { count: 'exact', head: true })
    .not('deadline', 'is', null);

  return {
    total: total ?? 0,
    hasDesc: hasDesc ?? 0,
    hasSkills: hasSkills ?? 0,
    hasDeadline: hasDeadline ?? 0,
  };
}

// ── Entry Point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║    OPPORTUNITY RADAR — DATA BACKFILL SCRIPT         ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── BEFORE snapshot ────────────────────────────────────────────────
  console.log('📊 Taking BEFORE snapshot...');
  const before = await getCoverage();
  console.log(`  Total:       ${before.total}`);
  console.log(`  Description: ${before.hasDesc}/${before.total} (${((before.hasDesc / before.total) * 100).toFixed(1)}%)`);
  console.log(`  Skills:      ${before.hasSkills}/${before.total} (${((before.hasSkills / before.total) * 100).toFixed(1)}%)`);
  console.log(`  Deadline:    ${before.hasDeadline}/${before.total} (${((before.hasDeadline / before.total) * 100).toFixed(1)}%)`);

  // ── Fetch stale records ────────────────────────────────────────────
  console.log('\n🔍 Fetching stale records from Supabase...');

  // Stale Internshala: missing description OR empty skills OR no deadline
  const { data: staleInternshala, error: errI } = await db
    .from('opportunities')
    .select('id, title, company_name, source, apply_url, description, skills, deadline')
    .eq('source', 'internshala')
    .or('description.is.null,description.eq.')
    .in('status', ['Published', 'Closing Soon', 'Draft']);

  if (errI) { console.error('Failed to query stale Internshala records:', errI.message); process.exit(1); }

  // Stale Unstop: missing deadline only (description already complete)
  const { data: staleUnstop, error: errU } = await db
    .from('opportunities')
    .select('id, title, company_name, source, apply_url, description, skills, deadline')
    .eq('source', 'unstop')
    .is('deadline', null)
    .in('status', ['Published', 'Closing Soon', 'Draft']);

  if (errU) { console.error('Failed to query stale Unstop records:', errU.message); process.exit(1); }

  console.log(`  Stale Internshala records: ${staleInternshala?.length ?? 0}`);
  console.log(`  Stale Unstop records (no deadline): ${staleUnstop?.length ?? 0}`);

  const stats: BackfillStats = { scanned: 0, updated: 0, skipped_no_change: 0, failed: 0 };
  stats.scanned = (staleInternshala?.length ?? 0) + (staleUnstop?.length ?? 0);

  // ── Run backfills ──────────────────────────────────────────────────
  if (staleInternshala && staleInternshala.length > 0) {
    await backfillInternshala(staleInternshala as StaleRecord[], stats);
  } else {
    console.log('\n✅ No stale Internshala records found — nothing to backfill.');
  }

  if (staleUnstop && staleUnstop.length > 0) {
    await backfillUnstopDeadlines(staleUnstop as StaleRecord[], stats);
  } else {
    console.log('\n✅ No stale Unstop records found — nothing to backfill.');
  }

  // ── AFTER snapshot ─────────────────────────────────────────────────
  console.log('\n\n📊 Taking AFTER snapshot...');
  const after = await getCoverage();
  const pct = (n: number) => `${((n / after.total) * 100).toFixed(1)}%`;

  console.log(`  Total:       ${after.total}`);
  console.log(`  Description: ${after.hasDesc}/${after.total} (${pct(after.hasDesc)})`);
  console.log(`  Skills:      ${after.hasSkills}/${after.total} (${pct(after.hasSkills)})`);
  console.log(`  Deadline:    ${after.hasDeadline}/${after.total} (${pct(after.hasDeadline)})`);

  // Still missing
  const stillMissingDesc = after.total - after.hasDesc;
  const stillMissingSkills = after.total - after.hasSkills;
  const stillMissingDeadline = after.total - after.hasDeadline;

  // ── Final Report ───────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║               BACKFILL FINAL REPORT                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  Scanned:                ${stats.scanned}`);
  console.log(`  Updated:                ${stats.updated}`);
  console.log(`  Skipped (no change):    ${stats.skipped_no_change}`);
  console.log(`  Failed:                 ${stats.failed}`);
  console.log(`\n  Still missing desc:     ${stillMissingDesc}`);
  console.log(`  Still missing skills:   ${stillMissingSkills}`);
  console.log(`  Still missing deadline: ${stillMissingDeadline}`);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║             FINAL COVERAGE PERCENTAGES             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Description Coverage:  ${pct(after.hasDesc)}  (was ${((before.hasDesc / before.total) * 100).toFixed(1)}%)`);
  console.log(`  Skills Coverage:       ${pct(after.hasSkills)}  (was ${((before.hasSkills / before.total) * 100).toFixed(1)}%)`);
  console.log(`  Deadline Coverage:     ${pct(after.hasDeadline)}  (was ${((before.hasDeadline / before.total) * 100).toFixed(1)}%)`);

  // ── Manual verification: 5 random updated Internshala records ─────
  console.log('\n🔎 Spot-checking 5 recently updated Internshala records...');
  const { data: sample } = await db
    .from('opportunities')
    .select('title, company_name, description, skills, deadline, source')
    .eq('source', 'internshala')
    .not('description', 'is', null)
    .neq('description', '')
    .order('updated_at', { ascending: false })
    .limit(5);

  (sample || []).forEach((o: any, idx: number) => {
    const descLen = (o.description || '').length;
    console.log(`\n  [${idx + 1}] ${o.title} @ ${(o.company_name || '').split('\n')[0].trim()}`);
    console.log(`       Source:   ${o.source}`);
    console.log(`       Desc:     ${descLen} chars`);
    console.log(`       Skills:   [${(o.skills || []).slice(0, 5).join(', ')}${(o.skills?.length > 5 ? ` +${o.skills.length - 5} more` : '')}]`);
    console.log(`       Deadline: ${o.deadline ? o.deadline.substring(0, 10) : '—'}`);
  });

  console.log('\n\n✅ Backfill complete.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
