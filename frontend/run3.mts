import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
process.env.ENABLE_OPP_INGESTION = 'true'
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { OpportunityIngestionService } = await import('./src/providers/opportunities/ingestion/OpportunityIngestionService.js')
  const { UnstopCompetitionsProvider } = await import('./src/providers/opportunities/providers/UnstopCompetitionsProvider.js')
  const t = Date.now()
  const stats = await new OpportunityIngestionService([new UnstopCompetitionsProvider(15)], db).runPipeline()
  console.log('=== STATS ===', JSON.stringify(stats))
  console.log('elapsed:', Math.round((Date.now()-t)/1000)+'s')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
