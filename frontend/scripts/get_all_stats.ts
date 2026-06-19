import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getCount(table: string, match?: any) {
  let query = db.from(table).select('*', { count: 'exact', head: true });
  if (match) {
    query = query.match(match);
  }
  const { count, error } = await query;
  if (error) {
    console.error(`Error counting ${table}:`, JSON.stringify(error));
    return 0;
  }
  return count || 0;
}

async function main() {
  const totalOpps = await getCount('opportunities');
  const activeOpps = await getCount('opportunities', { status: 'Published' });
  const expiredOpps = await getCount('opportunities', { status: 'Expired' });
  const totalCompanies = await getCount('companies');
  const totalUsers = await getCount('profiles');
  const totalBookmarks = await getCount('saved_opportunities');
  const totalTracked = await getCount('application_tracker');

  console.log(`=== LIVE METRICS ===`);
  console.log(`Total Opportunities: ${totalOpps}`);
  console.log(`Active Opportunities: ${activeOpps}`);
  console.log(`Expired Opportunities: ${expiredOpps}`);
  console.log(`Total Companies: ${totalCompanies}`);
  console.log(`Total Users: ${totalUsers}`);
  console.log(`Total Bookmarks: ${totalBookmarks}`);
  console.log(`Total Tracked Applications: ${totalTracked}`);
}

main().catch(console.error);
