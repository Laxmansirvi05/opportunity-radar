import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { performance } from 'perf_hooks';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Load modules
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';
import { UnstopProvider } from '../src/providers/opportunities/providers/UnstopProvider';
import { WellfoundProvider } from '../src/providers/opportunities/providers/WellfoundProvider';
import { InternshalaProvider } from '../src/providers/opportunities/providers/InternshalaProvider';

function formatMem(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function logMemory(label: string) {
  const mem = process.memoryUsage();
  console.log(`[Memory] ${label}: rss=${formatMem(mem.rss)}, heapTotal=${formatMem(mem.heapTotal)}, heapUsed=${formatMem(mem.heapUsed)}`);
}

async function main() {
  console.log('--- OPPORTUNITY RADAR PIPELINE PERFORMANCE MEASUREMENT ---');
  logMemory('Startup');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(supabaseUrl, supabaseKey);

  // Measure DB Time
  let totalDbTime = 0;
  let dbCalls = 0;
  
  // Create a Proxy for the Supabase client to measure query time
  const dbProxy = new Proxy(db, {
    get(target, prop, receiver) {
      const origMethod = target[prop as keyof typeof target];
      if (prop === 'from' || prop === 'rpc') {
        return function (...args: any[]) {
          const queryBuilder = (origMethod as any).apply(target, args);
          // Proxy the query builder methods that actually execute the query (then, catch, finally)
          return new Proxy(queryBuilder, {
            get(qbTarget, qbProp) {
              if (qbProp === 'then') {
                return function (resolve: any, reject: any) {
                  const start = performance.now();
                  dbCalls++;
                  return qbTarget.then((res: any) => {
                    totalDbTime += performance.now() - start;
                    resolve(res);
                  }).catch((err: any) => {
                    totalDbTime += performance.now() - start;
                    reject(err);
                  });
                };
              }
              const val = qbTarget[qbProp as keyof typeof qbTarget];
              return typeof val === 'function' ? val.bind(qbTarget) : val;
            }
          });
        };
      }
      return typeof origMethod === 'function' ? origMethod.bind(target) : origMethod;
    }
  });

  const providers = [
    new UnstopProvider(),
    new WellfoundProvider(),
    new InternshalaProvider(),
  ];

  // Measure provider fetch times
  const providerFetchTimes: Record<string, number> = {};
  for (const provider of providers) {
    const origFetch = provider.fetch;
    provider.fetch = async function() {
      const name = provider.constructor.name;
      const start = performance.now();
      console.log(`[Scrape] Starting ${name}...`);
      const res = await origFetch.apply(this);
      const duration = performance.now() - start;
      providerFetchTimes[name] = duration;
      console.log(`[Scrape] ${name} finished in ${(duration/1000).toFixed(2)}s. Extracted ${res.length} items.`);
      return res;
    };
  }

  const service = new OpportunityIngestionService(providers, dbProxy);

  console.log('\n--- STARTING PIPELINE ---');
  const pipelineStart = performance.now();
  
  // We run a dryRun to avoid polluting DB while measuring scraping
  // But wait, the user wants DB write time measured. The deduplication handles this.
  // Actually, we'll let it run normally, it will hit dedupe.
  // The DB write time will just be the SELECT queries for dedupe.
  const stats = await service.runPipeline(false);
  
  const pipelineEnd = performance.now();
  const totalDuration = pipelineEnd - pipelineStart;

  logMemory('Completion');

  console.log('\n--- PERFORMANCE REPORT ---');
  console.log(`Total Pipeline Duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Total DB Calls: ${dbCalls}`);
  console.log(`Total DB Time (SELECTs + logs): ${(totalDbTime / 1000).toFixed(2)} seconds`);
  
  console.log('\nProvider Fetch Times:');
  let totalFetchTime = 0;
  for (const [name, time] of Object.entries(providerFetchTimes)) {
    console.log(`  ${name}: ${(time / 1000).toFixed(2)} seconds`);
    totalFetchTime += time;
  }
  
  const overheadTime = totalDuration - totalFetchTime - totalDbTime;
  console.log(`\nLogic/Normalization/Overhead: ${(overheadTime / 1000).toFixed(2)} seconds`);

  console.log('\nStats:', stats);
  
  console.log('\n--- VERCEL ESTIMATES ---');
  console.log(`Hobby Limit (10s): ${totalDuration <= 10000 ? 'PASS' : 'FAIL'}`);
  console.log(`Pro Limit (60s): ${totalDuration <= 60000 ? 'PASS' : 'FAIL'}`);
  
  if ('status' in stats) {
    return;
  }
  
  // Scaling estimate
  // Internshala took X seconds for Y items. Unstop took A seconds for B items.
  // If we scale to 5000 items, how long?
  const itemsProcessed = stats.processed;
  if (itemsProcessed > 0) {
    const msPerItem = totalDuration / itemsProcessed;
    console.log(`\nAverage time per item: ${(msPerItem).toFixed(2)} ms`);
    console.log(`Est. 500 opportunities: ${((msPerItem * 500) / 1000).toFixed(2)}s`);
    console.log(`Est. 1000 opportunities: ${((msPerItem * 1000) / 1000).toFixed(2)}s`);
    console.log(`Est. 5000 opportunities: ${((msPerItem * 5000) / 1000).toFixed(2)}s`);
  }
}

main().catch(console.error);
