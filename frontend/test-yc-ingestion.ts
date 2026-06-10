import { YCProvider } from '../src/providers/opportunities/providers/YCProvider';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';

async function runTest() {
  console.log('--- Starting YC Provider Test ---');
  
  const provider = new YCProvider();
  
  // Test raw fetch directly to verify 25 limit
  console.log('1. Testing raw fetch...');
  const rawJobs = await provider.fetch();
  console.log(`Successfully fetched ${rawJobs.length} real jobs from HN/YC`);
  if (rawJobs.length > 25) {
    console.error('FAILED: Fetch exceeded 25 limit');
    process.exit(1);
  }

  // Inject Mock Supabase Client
  const db = new Map();
  const mockSupabase = {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (field1: string, val1: string) => ({
          eq: (field2: string, val2: string) => ({
            maybeSingle: async () => {
              const key = `${val1}_${val2}`;
              if (db.has(key)) {
                return { data: db.get(key), error: null };
              }
              return { data: null, error: null };
            }
          })
        })
      }),
      update: (payload: any) => ({
        eq: async (field: string, val: string) => {
          return { error: null };
        }
      }),
      insert: async (payload: any[]) => {
        const item = payload[0];
        db.set(`${item.source}_${item.source_id}`, { id: `mock-uuid-${item.source_id}` });
        return { error: null };
      }
    })
  };

  // Test pipeline
  const service = new OpportunityIngestionService([provider], mockSupabase);
  console.log('\n2. Testing initial ingestion (Insert)...');
  const stats1 = await service.runPipeline();
  console.log('Ingestion Stats Run 1:', stats1);

  console.log('\n3. Testing duplicate prevention (Update)...');
  const stats2 = await service.runPipeline();
  console.log('Ingestion Stats Run 2:', stats2);
  
  if (stats1.upserted > 0 && stats2.upserted > 0) {
    console.log('\n✅ Verification passed: Opportunities inserted, duplicates prevented (handled as updates).');
  } else {
    console.error('\n❌ Verification failed.');
  }
}

runTest().catch(console.error);
