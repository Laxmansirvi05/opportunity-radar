// The parse test shows all formats produce 2026 dates correctly.
// But the DB has 2020-07-xx dates. Need to find where 2020 actually comes from.
// Hypothesis: These records still have the ORIGINAL deadline written during the FIRST 
// ingestion run (before the backfill fix). The backfill script skips updating deadline
// if !record.deadline is false — meaning ANY existing deadline was preserved.
// 
// So the question is: Where did the 2020 deadline originate?
// 
// In the ORIGINAL InternshalaProvider.ts (before our fix), there was no detail page fetch.
// item.deadline = null was hardcoded. So how did 2020 get in?
//
// Check the migration files — multisource / ecosystem data was inserted via SQL migrations
// Maybe the 2020 dates came from THOSE migrations and these records were never ingested.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check a specific 2020 record to determine its history
  const { data: sample } = await db.from('opportunities')
    .select('id, title, company_name, source, source_id, apply_url, deadline, created_at, updated_at, status')
    .lt('deadline', '2021-01-01T00:00:00Z')
    .limit(5);
  
  console.log('=== SAMPLE 2020 RECORDS - FULL METADATA ===');
  (sample || []).forEach((o: any) => {
    console.log(`\nTitle:      ${o.title}`);
    console.log(`Company:    ${o.company_name?.split('\n')[0].trim()}`);
    console.log(`Source:     ${o.source}`);
    console.log(`Source ID:  ${o.source_id}`);
    console.log(`Apply URL:  ${o.apply_url}`);
    console.log(`Deadline:   ${o.deadline}`);
    console.log(`Created:    ${o.created_at}`);
    console.log(`Updated:    ${o.updated_at}`);
    console.log(`Status:     ${o.status}`);
    // If created == updated, it was never touched after initial insert
    const neverUpdated = o.created_at?.substring(0,19) === o.updated_at?.substring(0,19);
    console.log(`Never updated: ${neverUpdated}`);
  });

  // Now look at one of these URLs directly to understand the actual Internshala deadline format
  // The key question: did THESE records go through the backfill or were they skipped?
  // The backfill query was: .or('description.is.null,description.eq.')
  // If these records had a description before backfill, they were NOT included in the backfill
  
  const { data: descCheck } = await db.from('opportunities')
    .select('id, title, description, deadline')
    .lt('deadline', '2021-01-01T00:00:00Z')
    .limit(5);
  
  console.log('\n=== DO THESE RECORDS HAVE DESCRIPTIONS? ===');
  (descCheck || []).forEach((o: any) => {
    const hasDesc = o.description && o.description !== '';
    console.log(`  "${o.title}": has_desc=${hasDesc} desc_len=${(o.description||'').length} deadline=${o.deadline?.substring(0,10)}`);
  });

  // Source IDs — are these from seed data migrations?
  // Seed data from migration files typically has predictable source_ids like "opp_1", "opp_2"
  const { data: sourceIds } = await db.from('opportunities')
    .select('source_id, source')
    .lt('deadline', '2021-01-01T00:00:00Z')
    .limit(10);
  
  console.log('\n=== SOURCE IDs OF 2020 RECORDS ===');
  (sourceIds || []).forEach((o: any) => {
    console.log(`  [${o.source}] source_id: "${o.source_id}"`);
  });

  // Check if source_id looks like a URL slug (from Internshala, real scraped)
  // or like a seed ID (from migration SQL files)
  console.log('\n=== CONCLUSION ===');
  const internshalaSourceIds = (sourceIds||[]).filter((o:any) => o.source === 'internshala');
  const looksLikeSeed = internshalaSourceIds.filter((o:any) => /^[a-z_]+\d+$/.test(o.source_id || ''));
  const looksLikeScrape = internshalaSourceIds.filter((o:any) => /\d{10,}/.test(o.source_id || ''));
  console.log(`  Internshala 2020 records: ${internshalaSourceIds.length}`);
  console.log(`  Looks like seed (opp_N pattern): ${looksLikeSeed.length}`);
  console.log(`  Looks like real scrape (numeric ID): ${looksLikeScrape.length}`);
}

main().catch(console.error);
