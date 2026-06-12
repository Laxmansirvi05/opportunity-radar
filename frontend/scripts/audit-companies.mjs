import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// 1. All companies
const { data: allCompanies, error: cErr } = await supabase
  .from('companies').select('*');
console.log(`\n=== Q5: Total companies in DB: ${allCompanies?.length ?? 'error'} ===`);
if (allCompanies?.length > 0) {
  console.log('Column names:', Object.keys(allCompanies[0]).sort().join(', '));
  console.log('\nAll companies:');
  allCompanies.forEach(c => {
    console.log(`  id=${c.id}  name="${c.name}"  logo=${c.logo_url ? '✅' : 'null'}`);
  });
}

// 2. Opportunities with company_id set vs null
const { data: linked, error: lErr } = await supabase
  .from('opportunities')
  .select('id, title, company_id, company_name, source')
  .not('company_id', 'is', null);
console.log(`\n=== Q6: Opportunities with company_id set: ${linked?.length ?? 'error'} ===`);
if (linked?.length > 0) {
  linked.slice(0, 10).forEach(o =>
    console.log(`  [${o.source}] "${o.title}" → company_id=${o.company_id}`)
  );
}

const { count: totalOpp } = await supabase
  .from('opportunities')
  .select('id', { count: 'exact', head: true });

const { count: nullCompanyId } = await supabase
  .from('opportunities')
  .select('id', { count: 'exact', head: true })
  .is('company_id', null);

console.log(`\n=== Summary ===`);
console.log(`Total opportunities:             ${totalOpp}`);
console.log(`With company_id set:             ${totalOpp - nullCompanyId}`);
console.log(`With company_id = NULL:          ${nullCompanyId}`);
console.log(`% linked:                        ${(((totalOpp - nullCompanyId) / totalOpp) * 100).toFixed(1)}%`);

// 3. Source breakdown of all opportunities
const { data: sourceCounts } = await supabase
  .from('opportunities')
  .select('source, company_name');
const bySource = {};
sourceCounts?.forEach(o => {
  bySource[o.source] = (bySource[o.source] || 0) + 1;
});
console.log('\n=== Opportunities by source ===');
Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([s, c]) =>
  console.log(`  ${s}: ${c}`)
);

// 4. Check if any company name already duplicated in companies table
const names = allCompanies?.map(c => c.name) ?? [];
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log(`\n=== Company name duplicates in companies table: ${dupes.length} ===`);
if (dupes.length > 0) console.log('  Dupes:', dupes);
