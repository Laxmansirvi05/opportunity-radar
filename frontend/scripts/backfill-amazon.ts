import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { AmazonProvider } from '../src/providers/opportunities/providers/AmazonProvider';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfillAmazon() {
  console.log("Fetching ALL active records from Amazon API (up to 3000)...");
  const records = [];
  const LIMIT = 100;
  const MAX_RECORDS = 3000;

  for (let offset = 0; offset < MAX_RECORDS; offset += LIMIT) {
    try {
      const url = `https://www.amazon.jobs/en/search.json?offset=${offset}&result_limit=${LIMIT}&country=IND`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Amazon API failed at offset ${offset}`);
        break;
      }
      const data = await response.json();
      const jobs = data.jobs || [];
      if (jobs.length === 0) break;
      records.push(...jobs);
      console.log(`Fetched ${records.length} jobs...`);
    } catch (e) {
      console.error(e);
      break;
    }
  }

  console.log(`Finished fetching. Total records: ${records.length}`);

  const provider = new AmazonProvider();
  const service = new OpportunityIngestionService([provider], db);

  let updatedCount = 0;
  let insertedCount = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
     const chunk = records.slice(i, i + BATCH_SIZE);
     console.log(`Processing batch ${i} to ${i + chunk.length}`);
     await Promise.all(chunk.map(async (raw) => {
        try {
          const normalized = provider.normalize(raw);
          const res = await service.upsert(normalized);
          
          if (res.status === 'updated') updatedCount++;
          if (res.status === 'inserted') insertedCount++;

          if (res.id && normalized.skills && normalized.skills.length > 0) {
            const tagsPayload = normalized.skills.map((skill: string) => ({
               opportunity_id: res.id,
               tag_name: skill.trim()
            })).filter((t: any) => t.tag_name.length > 0);
            if (tagsPayload.length > 0) {
              await db.from('opportunity_tags').upsert(tagsPayload, { onConflict: 'opportunity_id,tag_name' });
            }
          }
        } catch(e) {
           console.error("Failed to upsert a record");
        }
     }));
  }

  console.log(`Backfill complete. Updated: ${updatedCount}, Inserted: ${insertedCount}`);
}

backfillAmazon().catch(console.error);
