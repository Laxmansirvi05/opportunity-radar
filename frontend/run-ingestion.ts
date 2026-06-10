import { createClient } from '@supabase/supabase-js';
import { YCProvider } from '../src/providers/opportunities/providers/YCProvider';
import { OpportunityIngestionService } from '../src/providers/opportunities/ingestion/OpportunityIngestionService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_u-kGLYM5RkJE4IECpRix0Q_PvTlBbCm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Starting Real YC Ingestion ---');
  const provider = new YCProvider();
  
  // Use real supabase client
  const service = new OpportunityIngestionService([provider], supabase);
  try {
    const stats = await service.runPipeline();
    console.log('Ingestion Stats:', stats);
  } catch (err) {
    console.error('Error during ingestion:', err);
  }
}

run();
