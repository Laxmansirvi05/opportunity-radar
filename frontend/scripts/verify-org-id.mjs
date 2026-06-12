// Fetches page 1 twice with a delay and compares organisation.id for the same opportunity
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function fetchUnstopPage(page = 1) {
  const res = await fetch(
    `https://unstop.com/api/public/opportunity/search-result?opportunity=internships&page=${page}`,
    { headers: HEADERS }
  );
  const json = await res.json();
  return json?.data?.data ?? [];
}

// --- Q1 + Q2: Check organisation.id uniqueness and stability ---
console.log('\n=== FETCH 1 ===');
const fetch1 = await fetchUnstopPage(1);
const orgMap1 = new Map();
fetch1.forEach(r => {
  orgMap1.set(r.id, { orgId: r.organisation?.id, orgName: r.organisation?.name });
});

// Show sample of org IDs
console.log('Sample opportunity → organisation.id mapping (first 5):');
let count = 0;
for (const [oppId, { orgId, orgName }] of orgMap1) {
  if (count++ >= 5) break;
  console.log(`  opp_id=${oppId}  org_id=${orgId}  org_name="${orgName}"`);
}

// Check if any organisation.id repeats (same org, multiple opportunities)
const orgIdCounts = {};
fetch1.forEach(r => {
  const oid = r.organisation?.id;
  if (oid) orgIdCounts[oid] = (orgIdCounts[oid] || 0) + 1;
});
const repeatedOrgs = Object.entries(orgIdCounts).filter(([_, c]) => c > 1);
console.log(`\nTotal records on page: ${fetch1.length}`);
console.log(`Unique organisation IDs: ${Object.keys(orgIdCounts).length}`);
console.log(`Orgs with multiple opportunities on same page: ${repeatedOrgs.length}`);
if (repeatedOrgs.length > 0) {
  console.log('  (confirms org_id is NOT globally unique per opportunity, but IS stable per org)');
  repeatedOrgs.slice(0, 3).forEach(([orgId, c]) => {
    const name = fetch1.find(r => r.organisation?.id == orgId)?.organisation?.name;
    console.log(`    org_id=${orgId} (${name}) appears ${c} times`);
  });
}

// --- Q2: Stability — fetch again and compare same opportunity IDs ---
console.log('\n=== FETCH 2 (stability check, same page) ===');
await new Promise(r => setTimeout(r, 2000)); // 2s gap
const fetch2 = await fetchUnstopPage(1);
const orgMap2 = new Map();
fetch2.forEach(r => {
  orgMap2.set(r.id, { orgId: r.organisation?.id, orgName: r.organisation?.name });
});

let mismatch = 0;
let matched = 0;
for (const [oppId, data1] of orgMap1) {
  const data2 = orgMap2.get(oppId);
  if (!data2) continue;
  if (data2.orgId !== data1.orgId) {
    mismatch++;
    console.log(`  MISMATCH opp_id=${oppId}: fetch1_org=${data1.orgId} fetch2_org=${data2.orgId}`);
  } else {
    matched++;
  }
}
console.log(`Matching records found in both fetches: ${matched}`);
console.log(`Organisation ID mismatches: ${mismatch}`);
console.log(mismatch === 0 ? '✅ organisation.id is STABLE across API refreshes' : '❌ organisation.id changed between fetches');

// --- Q3 + Q4: companies table constraints ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

console.log('\n=== COMPANIES TABLE: current state ===');
const { data: companies, error } = await supabase
  .from('companies')
  .select('*')
  .limit(5);

if (error) {
  console.log('Error querying companies:', error.message);
} else {
  console.log(`Total rows returned (limit 5): ${companies.length}`);
  if (companies.length > 0) {
    console.log('Column names:', Object.keys(companies[0]).sort().join(', '));
    console.log('Sample rows:');
    companies.forEach(c => console.log(`  id=${c.id}  name="${c.name}"  logo_url=${c.logo_url ? '(set)' : 'null'}`));
  } else {
    console.log('Companies table is EMPTY (0 rows).');
    console.log('Confirmed: ingestion pipeline has never written to companies table.');
  }
}
