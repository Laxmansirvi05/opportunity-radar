import { createClient } from '@supabase/supabase-js';
import { OpportunityIngestionService } from './OpportunityIngestionService';
import { InternshalaProvider } from '../providers/InternshalaProvider';
import { UnstopProvider } from '../providers/UnstopProvider';
import { WellfoundProvider } from '../providers/WellfoundProvider';
import { SkillExtractor } from '../utils/SkillExtractor';
import { OpportunityValidator } from '../validation/OpportunityValidator';
import { OpportunityProvider } from '../base/OpportunityProvider';

export class QueueConsumerService {
  private db: any;
  private ingestionService: OpportunityIngestionService;
  private providers: Map<string, OpportunityProvider>;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    this.db = createClient(supabaseUrl, serviceRoleKey);
    
    // We instantiate IngestionService purely to reuse its upsert and tagging logic.
    // In a future refactor, upsert logic should be extracted to a shared repository.
    const providersList = [
      new InternshalaProvider(),
      new UnstopProvider(),
      new WellfoundProvider()
    ];
    this.ingestionService = new OpportunityIngestionService(providersList, this.db);
    
    this.providers = new Map();
    this.providers.set('internshala', providersList[0]);
    this.providers.set('unstop', providersList[1]);
    this.providers.set('wellfound', providersList[2]);
  }

  async recoverStuckRows() {
    console.log("Running recovery for stuck processing rows...");
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data, error } = await this.db
      .from('ingestion_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', fifteenMinsAgo)
      .select('id');
      
    if (error) {
      console.error("Failed to recover rows:", error.message);
    } else if (data && data.length > 0) {
      console.log(`Recovered ${data.length} stuck rows back to pending.`);
    }
  }

  async processBatch(batchSize: number = 10) {
    const startTime = Date.now();
    let stats = { processed: 0, inserted: 0, failed: 0 };
    
    // 1. Recover stuck rows
    await this.recoverStuckRows();
    
    console.log(`\nFetching up to ${batchSize} pending queue rows...`);
    
    // 2. Claim rows atomically (pending -> processing)
    // We use a safe PostgreSQL RPC with FOR UPDATE SKIP LOCKED
    // to guarantee concurrent workers never claim the same rows.
    
    const { data: rowsToProcess, error: fetchErr } = await this.db
      .rpc('claim_queue_batch', { batch_size: batchSize });
      
    if (fetchErr || !rowsToProcess || rowsToProcess.length === 0) {
      console.log("No pending rows found.");
      return stats;
    }

    console.log(`Claimed ${rowsToProcess.length} rows.`);

    for (const row of rowsToProcess) {
      stats.processed++;
      const provider = this.providers.get(row.source);
      
      if (!provider) {
        await this.markFailed(row, new Error(`No provider found for source: ${row.source}`));
        stats.failed++;
        continue;
      }

      try {
        console.log(`Processing [${row.source}] ${row.url}`);
        
        // 3. Fetch Detail Page
        const rawDetail = await provider.fetchDetailPage(row.url);
        
        // 4 & 5. Normalize
        const normalized = provider.normalize(rawDetail);
        
        const validationResult = OpportunityValidator.validate(normalized);
        if (!validationResult.isValid) {
          throw new Error(`Validation Failed: ${JSON.stringify(validationResult.errors)}`);
        }

        // Extract Skills
        const extractedSkills = SkillExtractor.extract(normalized.description || '');
        normalized.skills = Array.from(new Set([...(normalized.skills || []), ...extractedSkills]));

        // 6 & 7. Save to opportunities and tags
        const upsertResult = await this.ingestionService.upsert(normalized);
        
        if (upsertResult.status === 'inserted' || upsertResult.status === 'updated') {
           if (upsertResult.id && normalized.skills && normalized.skills.length > 0) {
             const tagsPayload = normalized.skills.map((skill: string) => ({
               opportunity_id: upsertResult.id,
               tag_name: skill.trim()
             })).filter((t: any) => t.tag_name.length > 0);
             
             if (tagsPayload.length > 0) {
               await this.db.from('opportunity_tags').upsert(tagsPayload, { onConflict: 'opportunity_id,tag_name' });
             }
           }
           stats.inserted++;
        } else {
           throw new Error("Failed to upsert to database.");
        }

        // 8. Mark completed
        await this.db.from('ingestion_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null 
          })
          .eq('id', row.id);
          
      } catch (err: any) {
        console.error(`Error processing row ${row.id}:`, err.message);
        await this.markFailed(row, err);
        stats.failed++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nBatch complete in ${duration}s. Processed: ${stats.processed}, Inserted: ${stats.inserted}, Failed: ${stats.failed}`);
    return stats;
  }

  private async markFailed(row: any, error: Error) {
    const attempts = row.attempts + 1;
    const newStatus = attempts >= 3 ? 'failed' : 'pending';
    
    await this.db.from('ingestion_queue')
      .update({
        status: newStatus,
        attempts: attempts,
        last_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}
