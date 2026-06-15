import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table: string, select: string = '*') {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await db.from(table).select(select).range(from, from + pageSize - 1);
    if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function run() {
  console.log("Starting UX Data Audit...");

  const opportunities = await fetchAll('opportunities', 'id, title, company_name, apply_url, description, status, deadline, company_id, source, skills');
  const companies = await fetchAll('companies', 'id, name, website_url, logo_url');

  // 1. Missing apply links
  const missingApplyLinks = opportunities.filter(o => !o.apply_url || o.apply_url.trim() === '');
  console.log(`Missing apply links: ${missingApplyLinks.length}`);

  // 2. Broken apply links (malformed URL)
  const malformedLinks = opportunities.filter(o => {
    if (!o.apply_url) return false;
    try {
      new URL(o.apply_url);
      return false;
    } catch {
      return true;
    }
  });
  console.log(`Malformed apply links: ${malformedLinks.length}`);

  // 3. Missing descriptions
  const missingDesc = opportunities.filter(o => !o.description || o.description.trim().length < 20);
  console.log(`Missing/very short descriptions: ${missingDesc.length}`);
  if (missingDesc.length > 0) {
    console.log(`Examples:`, missingDesc.slice(0, 3).map(o => o.title));
  }

  // 4. Missing company names
  const missingCompanyName = opportunities.filter(o => !o.company_name || o.company_name.trim() === '');
  console.log(`Missing company names: ${missingCompanyName.length}`);

  // 5. Garbage company names
  const garbageRegex = /actively hiring|\\n|\\t|  +/i;
  const garbageCompanies = companies.filter(c => garbageRegex.test(c.name) || c.name !== c.name.trim());
  console.log(`Garbage company names in 'companies' table: ${garbageCompanies.length}`);
  if (garbageCompanies.length > 0) {
    console.log(`Examples:`, garbageCompanies.slice(0, 3).map(c => c.name));
  }

  const garbageOppCompanies = opportunities.filter(o => o.company_name && (garbageRegex.test(o.company_name) || o.company_name !== o.company_name.trim()));
  console.log(`Garbage company names in 'opportunities' table: ${garbageOppCompanies.length}`);

  // 6. Duplicate companies
  const companyNameMap = new Map();
  const duplicateCompanies = [];
  for (const c of companies) {
    const normalized = c.name.trim().toLowerCase();
    if (companyNameMap.has(normalized)) {
      duplicateCompanies.push(c);
    } else {
      companyNameMap.set(normalized, c);
    }
  }
  console.log(`Duplicate companies (by exact normalized name): ${duplicateCompanies.length}`);

  // 7. Invalid deadlines
  const now = new Date();
  const invalidDeadlines = opportunities.filter(o => {
    if (o.status !== 'Expired' && o.deadline) {
      const d = new Date(o.deadline);
      if (d < now) return true;
    }
    return false;
  });
  console.log(`Invalid deadlines (past date but not expired): ${invalidDeadlines.length}`);

  console.log("UX Data Audit Complete.");
}

run().catch(console.error);
