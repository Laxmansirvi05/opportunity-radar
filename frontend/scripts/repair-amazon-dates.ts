import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repairAmazonDates() {
  console.log("Fetching ALL active records from Amazon API (up to 3000)...");
  const LIMIT = 100;
  const MAX_RECORDS = 3000;
  let updatedCount = 0;
  let totalProcessed = 0;

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

      totalProcessed += jobs.length;
      
      const updatePromises = jobs.map(async (raw: any) => {
        if (!raw.posted_date) return;
        
        let postedAt;
        try {
          postedAt = new Date(raw.posted_date).toISOString();
        } catch (e) {
          return;
        }

        const sourceId = raw.id_icims || raw.id;
        if (!sourceId) return;

        // Perform a direct SQL UPDATE for safety and speed
        const { error } = await db
          .from('opportunities')
          .update({ posted_at: postedAt })
          .eq('source', 'amazon')
          .eq('source_id', sourceId);

        if (!error) {
          updatedCount++;
        }
      });

      await Promise.all(updatePromises);
      console.log(`Processed ${totalProcessed} jobs. Updated ${updatedCount} so far...`);
    } catch (e) {
      console.error(e);
      break;
    }
  }

  console.log(`\nRepair complete! Total records processed: ${totalProcessed}. Successfully updated: ${updatedCount}`);
  
  console.log("\nRunning Verification Queries...");
  
  const { data: q1 } = await db.rpc('query_amazon_unique_days');
  // Since we don't have an RPC for unique days, we can just select all dates and count in JS for verification
  
  const { data: allAmazon } = await db
    .from('opportunities')
    .select('posted_at')
    .eq('source', 'amazon');
    
  if (allAmazon) {
    const dates = allAmazon.map(x => x.posted_at ? x.posted_at.substring(0, 10) : 'NULL');
    const uniqueDates = new Set(dates);
    console.log(`SELECT COUNT(DISTINCT DATE(posted_at)) -> ${uniqueDates.size} unique days`);
    
    // Sort to find min/max
    const validDates = dates.filter(d => d !== 'NULL').sort();
    if (validDates.length > 0) {
      console.log(`SELECT MIN(posted_at) -> ${validDates[0]}`);
      console.log(`SELECT MAX(posted_at) -> ${validDates[validDates.length - 1]}`);
    }
    
    // Group by
    const grouped = dates.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("\nSELECT DATE(posted_at), COUNT(*)");
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        console.log(`${date} = ${count} records`);
      });
  }
}

repairAmazonDates().catch(console.error);
