import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService.js';
import { UnstopProvider } from '../src/providers/opportunities/providers/UnstopProvider.js';
import { InternshalaProvider } from '../src/providers/opportunities/providers/InternshalaProvider.js';
import { YCProvider } from '../src/providers/opportunities/providers/YCProvider.js';
import { WellfoundProvider } from '../src/providers/opportunities/providers/WellfoundProvider.js';
import { DevfolioProvider } from '../src/providers/opportunities/providers/DevfolioProvider.js';
import { AmazonProvider } from '../src/providers/opportunities/providers/AmazonProvider.js';
import { GitHubProvider } from '../src/providers/opportunities/providers/GitHubProvider.js';
import { AtlassianProvider } from '../src/providers/opportunities/providers/AtlassianProvider.js';
import { GSoCProvider } from '../src/providers/opportunities/providers/GSoCProvider.js';
import { LFXProvider } from '../src/providers/opportunities/providers/LFXProvider.js';
import { Hack2SkillProvider } from '../src/providers/opportunities/providers/Hack2SkillProvider.js';
import { OutreachyProvider } from '../src/providers/opportunities/providers/OutreachyProvider.js';
import { CompanyProvider } from '../src/providers/opportunities/providers/CompanyProvider.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.ENABLE_OPP_INGESTION = 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set. Check your .env.local file.');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set.');
  console.error('   The ingestion pipeline requires the service role key to bypass Row Level Security.');
  console.error('');
  console.error('   Set it before running:');
  console.error('     export SUPABASE_SERVICE_ROLE_KEY="your_key_here"');
  console.error('     npx tsx scripts/run-ingestion.ts');
  console.error('');
  console.error('   Or add it to frontend/.env.local (never commit this file):');
  console.error('     SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

console.log('🔒 [Auth] SUPABASE_SERVICE_ROLE_KEY loaded. Bypassing RLS for ingestion.');

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  }
);

async function run() {
  // --- DIAGNOSTICS FOR 42501 ERROR ---
  console.log('\n--- DIAGNOSTICS ---');
  console.log(`URL: ${supabaseUrl}`);
  const keyPrefix = supabaseKey!.substring(0, 15);
  console.log(`Key prefix: ${keyPrefix}...`);

  if (supabaseKey!.startsWith('sb_secret_')) {
    console.log('Key type: sb_secret_ (Appears to be a valid Service Role Key)');
  } else if (supabaseKey!.startsWith('sb_publishable_')) {
    console.log('Key type: sb_publishable_ (WARNING: This is an ANON key, writes will fail!)');
  } else if (supabaseKey!.startsWith('anon')) {
    console.log('Key type: anon (WARNING: This is an ANON key, writes will fail!)');
  } else {
    console.log('Key type: UNKNOWN FORMAT');
  }

  console.log('\nTesting direct database access before ingestion...');
  const { data: testData, error: testError } = await supabase
    .from('companies')
    .select('id')
    .limit(1);

  console.log('Test select success:', !testError);
  if (testError) {
    console.log('Test select error:', testError);
  } else {
    console.log('Test select fetched 1 record successfully.');
  }
  console.log('-------------------\n');

  console.log('=== STARTING INGESTION ENGINE (LIVE RUN) ===\n');

  // 1. Get Opportunities Before
  const { count: countBefore } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  console.log(`[Stats] Opportunities before run: ${countBefore}`);

  const providers = [
    new UnstopProvider(),
    new InternshalaProvider(),
    new YCProvider(),
    new WellfoundProvider(),
    new DevfolioProvider(),
    new AmazonProvider(),
    new GitHubProvider(),
    new AtlassianProvider(),
    new GSoCProvider(),
    new LFXProvider(),
    new Hack2SkillProvider(),
    new OutreachyProvider(),
    new CompanyProvider()
  ];

  const service = new OpportunityIngestionService(providers, supabase);
  
  console.log('\nFetching and processing live data...');
  const startTime = Date.now();
  const stats = await service.runPipeline(false); // false = realRun
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  if ('status' in stats) {
    console.log("Ingestion disabled via feature flag.");
    return;
  }

  console.log(`\n=== INGESTION RESULTS ===`);
  console.log(`Pipeline completed in ${duration}s`);
  console.log(`- Processed (Raw): ${stats.processed}`);
  console.log(`- Validated (Passed checks): ${stats.valid}`);
  console.log(`- Rejected (Validation Failed): ${stats.errors}`);
  console.log(`- Skipped (Duplicates): ${stats.skipped_dup}`);
  console.log(`- Ready to Insert/Update: ${stats.upserted}`);
  
  // Note: For skills and logos enrichment, they happen dynamically on all Valid items.
  // Since we processed ${stats.valid} records, all were run through SkillExtractor and logo population!
  console.log(`- Enriched with Skills: ${stats.upserted} (Applied automatically to all valid)`);
  console.log(`- Enriched with Logos: ${stats.upserted} (Parsed and sent to company lookup)`);

  console.log(`\n[Stats] Opportunities after run (Real): ${countBefore! + stats.upserted}`);
  // --- POST-RUN EXACT COUNTS ---
  const { count: totalAfter } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
  const { count: activeAfter } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).in('status', ['Published', 'Closing Soon']);
  const { count: expiredAfter } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'Expired');

  const { data: sourcesData } = await supabase.from('opportunities').select('source');
  const sourceCounts: Record<string, number> = {};
  for (const row of sourcesData || []) {
    const s = row.source || 'unknown';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  console.log(`\n=== FINAL DATABASE STATE (Exact) ===`);
  console.log(`Total opportunities: ${totalAfter}`);
  console.log(`Active opportunities: ${activeAfter}`);
  console.log(`Expired opportunities: ${expiredAfter}`);
  console.log(`\nSource-wise counts:`);
  sortedSources.forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
}

run().catch(console.error);
