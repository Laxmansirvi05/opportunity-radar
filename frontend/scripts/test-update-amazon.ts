import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { AmazonProvider } from '../src/providers/opportunities/providers/AmazonProvider';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';

dotenv.config({ path: '.env.local' });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  const url = `https://www.amazon.jobs/en/search.json?offset=0&result_limit=1&country=IND`;
  const response = await fetch(url);
  const data = await response.json();
  const raw = data.jobs[0];
  
  const provider = new AmazonProvider();
  const normalized = provider.normalize(raw);
  console.log("Normalized posted_at:", normalized.posted_at);
  
  const service = new OpportunityIngestionService([provider], db);
  const res = await service.upsert(normalized);
  console.log("Upsert result:", res);
  
  const { data: check } = await db.from('opportunities').select('title, posted_at, created_at, source_id').eq('source_id', normalized.source_id);
  console.log("DB Record:", check);
}
test();
