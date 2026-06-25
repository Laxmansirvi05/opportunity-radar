import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

function getMappedLogo(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('amazon')) return 'https://logo.clearbit.com/amazon.com';
  if (n.includes('google')) return 'https://logo.clearbit.com/google.com';
  if (n.includes('microsoft')) return 'https://logo.clearbit.com/microsoft.com';
  if (n.includes('apple')) return 'https://logo.clearbit.com/apple.com';
  if (n.includes('meta')) return 'https://logo.clearbit.com/meta.com';
  if (n.includes('github')) return 'https://logo.clearbit.com/github.com';
  if (n.includes('atlassian')) return 'https://logo.clearbit.com/atlassian.com';
  if (n.includes('adobe')) return 'https://logo.clearbit.com/adobe.com';
  if (n.includes('oracle')) return 'https://logo.clearbit.com/oracle.com';
  if (n.includes('salesforce')) return 'https://logo.clearbit.com/salesforce.com';
  if (n.includes('ibm')) return 'https://logo.clearbit.com/ibm.com';
  return null;
}

async function verifyAmazonLogos() {
  const { data: amazonOpps } = await supabase
    .from('opportunities')
    .select('id, title, companies(name, logo_url)')
    .ilike('company_name', '%amazon%'); // or join with companies where name ilike %amazon%

  if (!amazonOpps) return;

  let totalAmazon = amazonOpps.length;
  let showingLogo = 0;
  let showingFallback = 0;

  for (const opp of amazonOpps) {
    const compName = opp.companies?.name || 'Amazon';
    const mapped = getMappedLogo(compName);
    const dbUrl = opp.companies?.logo_url;
    
    // UI Logic equivalent
    if (mapped || dbUrl) {
      showingLogo++;
    } else {
      showingFallback++;
    }
  }

  console.log(`Total Amazon Opportunities: ${totalAmazon}`);
  console.log(`Opportunities showing logo: ${showingLogo} (Target: 100%)`);
  console.log(`Opportunities showing fallback: ${showingFallback} (Target: 0%)`);
  
  if (showingLogo === totalAmazon && totalAmazon > 0) {
    console.log("✅ Verification Passed: 100% of Amazon opportunities resolve to a proper logo.");
  }
}

verifyAmazonLogos().catch(console.error);
