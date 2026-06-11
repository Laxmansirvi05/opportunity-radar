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
  if (!url) return { valid: false, reason: 'Missing URL' };
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('example.com') || url.includes('placeholder')) {
    return { valid: false, reason: 'Local/Placeholder URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (response.status === 404 || response.status === 410) {
      return { valid: false, reason: `HTTP ${response.status}` };
    }
    if (response.url.includes('job-unavailable') || response.url.includes('closed') || response.url.includes('not-found')) {
      return { valid: false, reason: 'Redirected to closed job' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: `Fetch error: ${error.message}` };
  }
}

function isDemoData(opp) {
  const textToSearch = `${opp.title} ${opp.description} ${opp.recruiter_name}`.toLowerCase();
  if (textToSearch.includes('demo data') || textToSearch.includes('test opportunity') || textToSearch.includes('jane doe') || textToSearch.includes('test recruiter')) {
    return true;
  }
  return false;
}

function isExpired(opp) {
  if (opp.status && opp.status.toLowerCase() === 'closed') return true;
  if (opp.deadline) {
    const deadlineDate = new Date(opp.deadline);
    if (deadlineDate < new Date()) return true;
  }
  return false;
}

async function runCleanup() {
  console.log("Starting Final Database Cleanup Generation...\n");

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  const sqlFilePath = path.join(process.cwd(), 'final_cleanup.sql');
  fs.writeFileSync(sqlFilePath, '-- FINAL DATABASE CLEANUP SCRIPT\n-- Run this in your Supabase SQL Editor\n\n');

  const seenUrls = new Set();
  const seenTitles = new Set();
  const toDelete = [];
  let deleteCount = 0;

  console.log(`Auditing ${opportunities.length} opportunities...\n`);

  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    let deleteReason = null;

    // 1. Missing URL
    if (!opp.apply_url || opp.apply_url.trim() === '') {
      deleteReason = 'Missing URL';
    }
    
    // 2. Weak Description
    else if (!opp.description || opp.description.trim().length < 50) {
      deleteReason = 'Weak description (< 50 chars)';
    }

    // 3. Demo / Test Data
    else if (isDemoData(opp)) {
      deleteReason = 'Demo/Test data';
    }

    // 4. Expired Job
    else if (isExpired(opp)) {
      deleteReason = 'Expired job';
    }

    // 5. Duplicates (URLs)
    else if (seenUrls.has(opp.apply_url)) {
      deleteReason = 'Duplicate URL';
    }

    // 6. Duplicates (Title + Company)
    else if (seenTitles.has(`${opp.title}-${opp.company_id}`)) {
      deleteReason = 'Duplicate Title/Company';
    }

    // 7. Broken Links
    else {
      const urlCheck = await validateUrl(opp.apply_url);
      if (!urlCheck.valid) {
        deleteReason = `Broken link (${urlCheck.reason})`;
      }
    }

    if (deleteReason) {
      fs.appendFileSync(sqlFilePath, `DELETE FROM opportunities WHERE id = '${opp.id}'; -- Reason: ${deleteReason}\n`);
      deleteCount++;
    } else {
      // It's a valid, unique record. Keep it.
      seenUrls.add(opp.apply_url);
      seenTitles.add(`${opp.title}-${opp.company_id}`);
    }

    if (i % 25 === 0 && i > 0) {
      console.log(`Processed ${i}/${opportunities.length}...`);
    }
  }

  console.log(`\nCleanup audit complete! Generated ${deleteCount} DELETE statements in frontend/final_cleanup.sql`);
}

runCleanup();
