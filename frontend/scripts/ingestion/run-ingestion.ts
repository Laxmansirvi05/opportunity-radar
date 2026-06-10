import { createClient } from '@supabase/supabase-js';
import { AmazonProvider } from '../../../src/providers/opportunities/providers/AmazonProvider';
import { GitHubProvider } from '../../../src/providers/opportunities/providers/GitHubProvider';
import { AtlassianProvider } from '../../../src/providers/opportunities/providers/AtlassianProvider';
import { OpportunityIngestionService } from '../../../src/providers/opportunities/ingestion/OpportunityIngestionService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_u-kGLYM5RkJE4IECpRix0Q_PvTlBbCm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Starting Real Enterprise Ingestion ---');
  const providers = [
    new AmazonProvider(),
    new GitHubProvider(),
    new AtlassianProvider(),
  ];

  // Use real supabase client
  const service = new OpportunityIngestionService(providers, supabase);
  try {
    const stats = await service.runPipeline();
    console.log('Ingestion Stats:', stats);
  } catch (err) {
    console.error('Error during ingestion:', err);
  }
}

run();
