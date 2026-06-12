import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: oppsCount } = await db.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: companiesCount } = await db.from('companies').select('*', { count: 'exact', head: true });
  const { count: tagsCount } = await db.from('opportunity_tags').select('*', { count: 'exact', head: true });

  console.log(`Opportunities: ${oppsCount}`);
  console.log(`Companies: ${companiesCount}`);
  console.log(`Tags: ${tagsCount}`);
}

main().catch(console.error);
