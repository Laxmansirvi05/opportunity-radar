const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const files = [
  "apply_db_changes.ts", "audit-a.ts", "audit-b.ts", "audit-c.ts", "audit-companies.mjs",
  "audit-d.ts", "audit-data-full.ts", "audit-data.ts", "audit-empty-skills.ts", "audit-skills.mjs",
  "audit_fields.ts", "audit_internshala_detail.ts", "audit_internshala_detail2.ts", "audit_internshala_live.ts",
  "audit_internshala_selectors.ts", "audit_tags.ts", "backfill-amazon.ts", "backfill-enrichment.ts",
  "capacity-report.ts", "check-columns.mjs", "check-duplicates.ts", "check-indexes.ts", "check-logs.ts",
  "check_empty_skills.ts", "check_logs.ts", "cleanup-metrics.mjs", "compute-stats.mjs", "content_audit.ts",
  "deadline-deep.ts", "deadline-parse-test.ts", "desc_depth.ts", "execute-cleanup.mjs", "expired-data-audit.ts",
  "final-audit.mjs", "final-cleanup.mjs", "final-db-audit.ts", "final-verification.ts", "fix-data-integrity.ts",
  "full-audit.ts", "get_all_stats.ts", "get_db_stats.ts", "live-query.mjs", "master-audit.ts", "measure_performance.ts",
  "missing_examples.ts", "normalize-and-extract.mjs", "phase1-cleanup.ts", "post-fix-verify.ts", "query-stats.ts",
  "repair-amazon-dates.ts", "repair-deadlines.ts", "reprocess_skills.ts", "run-cron.ts", "run-ingestion.ts",
  "run-maintenance.mjs", "run-migration-remote.ts", "run-migration.ts", "run-producer.ts", "run-worker.ts",
  "sample-unstop-api.mjs", "stats.ts", "temp_get_url.ts", "test-amazon-api.ts", "test-amazon-dates.ts",
  "test-amazon-payload-keys.ts", "test-amazon-payload.ts", "test-amazon-quality.ts", "test-amazon.ts",
  "test-bulk-upsert.ts", "test-cron-handlers.mjs", "test-eq-null.js", "test-fallback.ts", "test-rpc.ts",
  "test-search-api.ts", "test-split-routes.ts", "test-unstop.ts", "test-update-amazon.ts", "test_amazon_api.ts",
  "test_counts.ts", "test_counts_detail.ts", "test_example.ts", "test_internshala.ts", "test_recent.ts",
  "test_recent_ids.ts", "test_recently_viewed.ts", "test_scraper.ts", "test_signup.ts", "unstop-audit.ts",
  "unstop-latency.ts", "ux-audit.ts", "ux-fix.ts", "validate-links-and-audit.mjs", "validate-urls.js",
  "verify-amazon-final.ts", "verify-amazon-logos.ts", "verify-concurrency.ts", "verify-cron.ts",
  "verify-org-id.mjs", "verify-skills.ts", "verify_queue.ts"
];

if (!fs.existsSync('frontend/scripts/archive')) {
  fs.mkdirSync('frontend/scripts/archive', { recursive: true });
}

let movedCount = 0;

files.forEach(f => {
  let category = "Safe to Delete";

  if (f.includes('run-cron') || f.includes('run-worker') || f.includes('run-producer') || f.includes('run-ingestion')) {
    category = "Production Required";
  } else if (f.includes('stats') || f === 'apply_db_changes.ts' || f.includes('check-logs') || f.includes('check_logs') || f === 'live-query.mjs') {
    category = "Development Utility";
  } else if (f.includes('backfill') || f.includes('migration') || f.includes('repair') || f.includes('fix') || f.includes('cleanup') || f.includes('reprocess') || f.includes('normalize')) {
    category = "One-Time Migration";
  } else if (f.includes('audit') || f.includes('test') || f.includes('verify') || f.includes('check') || f.includes('sample') || f.includes('temp')) {
    category = "Safe to Delete";
  } else {
    category = "Safe to Delete";
  }

  if (category === "Safe to Delete") {
    const src = path.join('frontend/scripts', f);
    const dest = path.join('frontend/scripts/archive', f);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      movedCount++;
    }
  }
});

console.log(`Moved ${movedCount} files to frontend/scripts/archive/`);
