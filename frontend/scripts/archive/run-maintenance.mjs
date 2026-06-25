/**
 * Standalone maintenance test runner.
 * Run with: node --env-file=.env.local scripts/run-maintenance.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const now = new Date().toISOString();
const startTime = Date.now();

// ── Step 1: Deadline expiration ────────────────────────────────────────────
console.log('\n=== MAINTENANCE RUN START ===');
console.log(`Timestamp: ${now}\n`);

console.log('[ Step 1 ] Deadline expiration...');
const { data: deadlineRows, error: deadlineErr } = await db
  .from('opportunities')
  .update({ status: 'Expired', updated_at: now })
  .in('status', ['Published', 'Closing Soon'])
  .not('deadline', 'is', null)
  .lt('deadline', now)
  .select('id, title, deadline');

if (deadlineErr) {
  console.error('  Deadline expiration ERROR:', deadlineErr.message);
} else {
  console.log(`  ✅ Deadline-expired: ${deadlineRows?.length ?? 0} opportunities`);
  (deadlineRows || []).forEach(r => console.log(`     - [${r.id.slice(0,8)}] ${r.title} (deadline: ${r.deadline})`));
}
const deadlineExpired = deadlineRows?.length ?? 0;

// ── Step 2: Freshness verification ─────────────────────────────────────────
console.log('\n[ Step 2 ] Freshness URL verification (sample: 50)...');
const { data: opps, error: sampleErr } = await db
  .from('opportunities')
  .select('id, title, apply_url')
  .eq('status', 'Published')
  .order('last_verified_at', { ascending: true, nullsFirst: true })
  .limit(50);

if (sampleErr) {
  console.error('  Sample fetch ERROR:', sampleErr.message);
}

let freshnessChecked = 0;
let freshnessExpired = 0;

for (const opp of (opps || [])) {
  freshnessChecked++;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(opp.apply_url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404 || response.status === 410) {
      console.log(`  ❌ Dead link (HTTP ${response.status}): ${opp.title} — ${opp.apply_url}`);
      await db.from('opportunities')
        .update({ status: 'Expired', updated_at: now, last_verified_at: now })
        .eq('id', opp.id);
      freshnessExpired++;
    } else {
      // Mark alive
      await db.from('opportunities')
        .update({ last_verified_at: now })
        .eq('id', opp.id);
    }
  } catch (_e) {
    // Timeout/DNS - skip silently, not a permanent failure
  }
}

console.log(`  ✅ URLs checked: ${freshnessChecked}, dead links expired: ${freshnessExpired}`);

// ── Step 3: Write ingestion_log ────────────────────────────────────────────
console.log('\n[ Step 3 ] Writing to ingestion_logs...');
const durationMs = Date.now() - startTime;
const totalExpired = deadlineExpired + freshnessExpired;

const { data: logRow, error: logErr } = await db.from('ingestion_logs').insert({
  provider: 'MaintenanceService',
  records_processed: freshnessChecked,
  records_inserted: 0,
  records_updated: totalExpired,
  records_rejected: freshnessExpired,
  records_skipped_dup: deadlineExpired,
  execution_time_ms: durationMs,
  status: 'SUCCESS',
  error_message: null,
}).select('id, created_at').single();

if (logErr) {
  console.error('  Log write ERROR:', logErr.message);
} else {
  console.log(`  ✅ Log written — ID: ${logRow.id}, created_at: ${logRow.created_at}`);
}

// ── Step 4: Verify database state ─────────────────────────────────────────
console.log('\n[ Step 4 ] Post-run database counts...');
const { count: publishedCount } = await db.from('opportunities')
  .select('*', { count: 'exact', head: true }).eq('status', 'Published');
const { count: expiredCount } = await db.from('opportunities')
  .select('*', { count: 'exact', head: true }).eq('status', 'Expired');
const { count: totalLogs } = await db.from('ingestion_logs')
  .select('*', { count: 'exact', head: true }).eq('provider', 'MaintenanceService');

console.log(`  Published opportunities: ${publishedCount}`);
console.log(`  Expired opportunities:   ${expiredCount}`);
console.log(`  Maintenance log rows:    ${totalLogs}`);

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n=== MAINTENANCE RUN COMPLETE ===');
console.log(`Duration:           ${durationMs}ms`);
console.log(`Deadline-expired:   ${deadlineExpired}`);
console.log(`URLs checked:       ${freshnessChecked}`);
console.log(`Dead links expired: ${freshnessExpired}`);
console.log(`Total expired:      ${totalExpired}`);
console.log(`Log record ID:      ${logRow?.id ?? 'FAILED'}`);
console.log('================================\n');
