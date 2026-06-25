import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function validateUrl(url) {
  if (!url) return { valid: false, reason: "Missing URL" };
  if (url.includes('localhost') || url.includes('127.0.0.1')) return { valid: false, reason: "Localhost URL" };
  if (url.includes('example.com') || url.includes('placeholder')) return { valid: false, reason: "Placeholder URL" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET', // some sites reject HEAD
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    // Treat 404, 410, and generic server errors as invalid
    if (response.status === 404 || response.status === 410) {
      return { valid: false, reason: `Status ${response.status}` };
    }
    
    // Check for common redirect keywords indicating job closed
    if (response.url.includes('job-unavailable') || response.url.includes('closed') || response.url.includes('not-found')) {
      return { valid: false, reason: `Redirected to closed job: ${response.url}` };
    }

    return { valid: true, reason: 'OK' };
  } catch (error) {
    return { valid: false, reason: `Fetch error: ${error.message}` };
  }
}

async function runAudit() {
  console.log("Fetching opportunities...");
  
  // We may need to fetch iteratively if there are many, but let's fetch all up to a large limit
  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, title, apply_url, source_type')
    .limit(10000);

  const sqlFilePath = path.join(process.cwd(), 'production_cleanup.sql');
  // Initialize file
  fs.writeFileSync(sqlFilePath, '-- Production DB Cleanup Script\n-- Run this in your Supabase SQL Editor\n\n');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  console.log(`Found ${opportunities.length} opportunities. Validating links...`);

  const report = {
    total: opportunities.length,
    bySource: {},
    validLinks: 0,
    invalidLinks: 0,
    recordsRemoved: 0,
    recordsKept: 0,
    invalidDetails: []
  };

  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    const source = opp.source_type || 'Unknown';
    if (!report.bySource[source]) {
      report.bySource[source] = { total: 0, valid: 0, invalid: 0 };
    }
    report.bySource[source].total++;

    const validation = await validateUrl(opp.apply_url);
    
    if (validation.valid) {
      report.validLinks++;
      report.bySource[source].valid++;
      report.recordsKept++;
    } else {
      report.invalidLinks++;
      report.bySource[source].invalid++;
      report.recordsRemoved++;
      report.invalidDetails.push(`- ID: ${opp.id} | Title: ${opp.title} | Source: ${source} | URL: ${opp.apply_url} | Reason: ${validation.reason}`);
      
      // Log for report and append to cleanup SQL
      fs.appendFileSync(sqlFilePath, `DELETE FROM opportunities WHERE id = '${opp.id}'; -- Reason: ${validation.reason}\n`);
    }
    
    if (i % 10 === 0 && i > 0) {
      console.log(`Processed ${i}/${opportunities.length} opportunities...`);
    }
  }

  console.log("Validation complete! Generating report...");

  let markdown = `# Production Data Audit Report\n\n`;
  markdown += `**Total Opportunities (Initial):** ${report.total}\n`;
  markdown += `**Valid Apply Links:** ${report.validLinks}\n`;
  markdown += `**Invalid Apply Links:** ${report.invalidLinks}\n`;
  markdown += `**Records Kept:** ${report.recordsKept}\n`;
  markdown += `**Records Removed:** ${report.recordsRemoved}\n\n`;

  markdown += `## Breakdown By Source\n\n`;
  markdown += `| Source | Total Records | Valid Links | Invalid Links | Records Removed | Records Kept |\n`;
  markdown += `|---|---|---|---|---|---|\n`;

  for (const [source, stats] of Object.entries(report.bySource)) {
    markdown += `| ${source} | ${stats.total} | ${stats.valid} | ${stats.invalid} | ${stats.invalid} | ${stats.valid} |\n`;
  }

  markdown += `\n## Sample of Invalid Links Removed\n\n`;
  markdown += report.invalidDetails.slice(0, 50).join('\n') + (report.invalidDetails.length > 50 ? '\n- ...and more' : '');

  fs.writeFileSync(path.join(process.cwd(), 'data_audit_report.md'), markdown);
  console.log("Report saved to frontend/data_audit_report.md");
}

runAudit();
