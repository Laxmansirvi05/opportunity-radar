import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('Fetching all active opportunities...');
  let allOps: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .range(page * 1000, (page + 1) * 1000 - 1);
      
    if (error) {
      console.error('Error fetching:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allOps.push(...data);
    page++;
  }
  
  console.log(`Total active fetched: ${allOps.length}`);

  let brokenLinks = 0;
  let invalidUrls = 0;
  let expiredVisible = 0;
  let missingDesc = 0;
  let missingCompany = 0;
  let missingTitle = 0;
  let missingCategory = 0;
  let missingLocation = 0;
  
  const linkSet = new Set<string>();
  let duplicateOps = 0;
  
  const companySet = new Set<string>();
  let duplicateCompanies = 0;

  const now = new Date();

  allOps.forEach(op => {
    // 1 & 2. Broken/Invalid Links
    if (!op.apply_url || op.apply_url.trim() === '') {
      brokenLinks++;
    } else if (!op.apply_url.startsWith('http')) {
      invalidUrls++;
    } else {
      if (linkSet.has(op.apply_url)) {
        duplicateOps++;
      } else {
        linkSet.add(op.apply_url);
      }
    }

    // 3. Expired opportunities
    if (op.expires_at) {
      const expDate = new Date(op.expires_at);
      if (expDate < now && op.status === 'active') {
        expiredVisible++;
      }
    }

    // 4. Missing descriptions
    if (!op.description || op.description.trim().length < 10) missingDesc++;
    
    // 5. Missing company
    if (!op.company_name || op.company_name.trim() === '') missingCompany++;
    else {
      const cname = op.company_name.toLowerCase().trim();
      if (companySet.has(cname)) {
        // Just track unique names to see if companies are heavily duplicated? 
        // Wait, "Duplicate company records" refers to the `companies` table or unique company names in the opportunities table?
        // Let's count them later.
      }
      companySet.add(cname);
    }

    // 6. Missing titles
    if (!op.title || op.title.trim() === '') missingTitle++;

    // 7. Missing categories
    if (!op.category || op.category.trim() === '') missingCategory++;

    // 8. Missing locations
    if (!op.location || op.location.trim() === '') missingLocation++;
  });

  // Fetch from companies table to check duplicate companies properly
  const { data: companiesData } = await supabase.from('companies').select('*');
  const cMap = new Map<string, number>();
  companiesData?.forEach(c => {
    const name = c.name?.toLowerCase().trim();
    if (name) cMap.set(name, (cMap.get(name) || 0) + 1);
  });
  let duplicateCompanyRecords = 0;
  cMap.forEach(count => {
    if (count > 1) duplicateCompanyRecords += (count - 1);
  });

  console.log('--- SECTION A RESULTS ---');
  console.log(`1/2. Broken/Invalid URLs: ${brokenLinks} / ${invalidUrls}`);
  console.log(`3. Expired but visible: ${expiredVisible}`);
  console.log(`4. Missing descriptions: ${missingDesc}`);
  console.log(`5. Missing company names: ${missingCompany}`);
  console.log(`6. Missing titles: ${missingTitle}`);
  console.log(`7. Missing categories: ${missingCategory}`);
  console.log(`8. Missing locations: ${missingLocation}`);
  console.log(`9. Duplicate opportunities (by link): ${duplicateOps}`);
  console.log(`10. Duplicate company records (in companies table): ${duplicateCompanyRecords}`);
}

runAudit();
