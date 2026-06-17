import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';
import { OpportunityProvider } from '../src/providers/opportunities/base/OpportunityProvider';
import { NormalizedOpportunity } from '../src/providers/opportunities/types/NormalizedOpportunity';
import { ValidationResult } from '../src/providers/opportunities/validation/OpportunityValidator';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// A mock provider that generates N records
class BenchmarkProvider extends OpportunityProvider {
  private count: number;
  private prefix: string;

  constructor(count: number, prefix: string) {
    super();
    this.count = count;
    this.prefix = prefix;
  }

  async fetch(): Promise<any[]> {
    const data = [];
    for (let i = 0; i < this.count; i++) {
      data.push({
        id: `${this.prefix}_job_${i}`,
        title: `Software Engineer ${this.prefix} ${i}`,
        company: `Benchmark Corp ${this.prefix}`,
        location: "Remote",
        description: "This is a long description to simulate real payload size. ".repeat(10)
      });
    }
    return data;
  }

  normalize(raw: any): NormalizedOpportunity {
    return {
      title: raw.title,
      company: raw.company,
      location: raw.location,
      description: raw.description,
      source: "benchmark_test",
      source_id: raw.id,
      apply_url: `https://benchmark.com/jobs/${raw.id}`,
      category: "Job",
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }
}

async function runBenchmark(count: number, prefix: string) {
  console.log(`\n--- Starting Benchmark: ${count} records ---`);
  const provider = new BenchmarkProvider(count, prefix);
  const service = new OpportunityIngestionService([provider], supabase);

  const start = Date.now();
  const stats = await service.runPipeline();
  const elapsedMs = Date.now() - start;

  console.log(`Pipeline finished in ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} seconds)`);
  console.log(`Stats:`, stats);
}

async function main() {
  // We'll use different prefixes so they insert as new records
  await runBenchmark(100, "B100");
  await runBenchmark(500, "B500");
  await runBenchmark(1000, "B1000");

  console.log("\nBenchmarks complete. Cleaning up test data...");
  const { error } = await supabase.from('opportunities').delete().eq('source', 'benchmark_test');
  if (error) console.error("Cleanup failed:", error);
  else console.log("Cleanup successful.");
  
  process.exit(0);
}

main();
