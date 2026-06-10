import { createClient } from '@supabase/supabase-js';
import { OpportunityProvider } from '../base/OpportunityProvider';
import { OpportunityValidator, ValidationResult } from '../validation/OpportunityValidator';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

// Assuming env vars are available for testing/execution or a mock client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
const defaultSupabase = createClient(supabaseUrl, supabaseKey);

export class OpportunityIngestionService {
  private providers: OpportunityProvider[];
  private db: any;
  private fingerprintSet: Set<string> = new Set();

  constructor(providers: OpportunityProvider[], dbClient: any = defaultSupabase) {
    this.providers = providers;
    this.db = dbClient;
  }

  // Generate a simplistic fingerprint to catch obvious cross-provider duplicates
  private generateFingerprint(title: string, company: string): string {
    const normalizeString = (str: string) => 
      str.toLowerCase()
         .replace(/\(.*\)/g, '') // remove parentheticals
         .replace(/\\b(intern|internship|role|at|inc|llc|ltd)\\b/g, '') // remove stop words
         .replace(/[^a-z0-9]/g, '') // strip special chars and spaces
         .trim();
    
    return `${normalizeString(company)}:${normalizeString(title)}`;
  }

  async runPipeline() {
    let globalStats = { processed: 0, valid: 0, upserted: 0, skipped_dup: 0, errors: 0 };

    // Pre-load existing fingerprints from DB to prevent cross-source dupes on subsequent runs
    const { data: existingRecords } = await this.db.from('opportunities').select('title, company_name');
    if (existingRecords) {
      existingRecords.forEach((record: any) => {
        if (record.title && record.company_name) {
          this.fingerprintSet.add(this.generateFingerprint(record.title, record.company_name));
        }
      });
    }

    for (const provider of this.providers) {
      const startTime = Date.now();
      let providerStats = { processed: 0, inserted: 0, updated: 0, skipped_dup: 0, errors: 0 };
      let providerName = provider.constructor.name;
      
      try {
        // 1. Fetch raw data
        const rawData = await provider.fetch();
        
        for (const raw of rawData) {
          globalStats.processed++;
          providerStats.processed++;
          
          // 2. Normalize
          const normalized = provider.normalize(raw);
          
          // 3. Validate
          const validationResult: ValidationResult = OpportunityValidator.validate(normalized);
          
          if (!validationResult.isValid) {
            console.warn(`[Validation Failed] ${normalized.title}:`, validationResult.errors);
            globalStats.errors++;
            providerStats.errors++;
            continue;
          }
          
          globalStats.valid++;

          // 4. Duplicate Protection (Cross-Source)
          const fingerprint = this.generateFingerprint(normalized.title, normalized.company);
          if (this.fingerprintSet.has(fingerprint)) {
             console.log(`[Duplicate Skipped] ${normalized.company} - ${normalized.title}`);
             globalStats.skipped_dup++;
             providerStats.skipped_dup++;
             continue; // Skip upsert if it's a cross-source duplicate
          }
          
          // Add to set to prevent intra-run duplicates
          this.fingerprintSet.add(fingerprint);

          // 5. Upsert with DB logic
          const upsertResult = await this.upsert(normalized);
          if (upsertResult === 'inserted') {
            globalStats.upserted++;
            providerStats.inserted++;
          } else if (upsertResult === 'updated') {
             globalStats.upserted++;
             providerStats.updated++;
          } else {
            globalStats.errors++;
            providerStats.errors++;
          }
        }
        
        // Log Success to DB
        await this.logRun(providerName, providerStats, 'SUCCESS', null, Date.now() - startTime);

      } catch (error: any) {
        console.error(`Pipeline error for provider:`, error);
        // Log Failure to DB
        await this.logRun(providerName, providerStats, 'FAILED', error.message || 'Unknown error', Date.now() - startTime);
      }
    }

    // 6. Handle Expiration
    await this.expireOpportunities();

    return globalStats;
  }

  private async logRun(providerName: string, stats: any, status: string, errorMessage: string | null, executionTimeMs: number) {
    try {
      await this.db.from('ingestion_logs').insert({
        provider: providerName,
        records_processed: stats.processed,
        records_inserted: stats.inserted,
        records_updated: stats.updated,
        records_rejected: stats.errors,
        records_skipped_dup: stats.skipped_dup,
        execution_time_ms: executionTimeMs,
        status: status,
        error_message: errorMessage
      });
    } catch (e) {
      console.error('Failed to write ingestion log:', e);
    }
  }

  private async expireOpportunities() {
    try {
      const now = new Date().toISOString();
      // Only expire if deadline is strictly before NOW
      const { error } = await this.db
        .from('opportunities')
        .update({ status: 'Expired', updated_at: now })
        .in('status', ['Published', 'Closing Soon'])
        .not('deadline', 'is', null)
        .lt('deadline', now);
        
      if (error) throw error;
      console.log('Successfully ran expiration routine.');
    } catch (e) {
      console.error('Error running expiration routine:', e);
    }
  }

  private async upsert(opportunity: NormalizedOpportunity): Promise<'inserted' | 'updated' | 'error'> {
    try {
      // Check if it already exists by source and source_id
      const { data: existing, error: selectError } = await this.db
        .from('opportunities')
        .select('id')
        .eq('source', opportunity.source)
        .eq('source_id', opportunity.source_id)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      const payload = {
        title: opportunity.title,
        company_name: opportunity.company, // mapped to denormalized company_name
        location: opportunity.location,
        description: opportunity.description,
        requirements: opportunity.skills || [],
        deadline: opportunity.deadline,
        source: opportunity.source,
        source_id: opportunity.source_id,
        apply_url: opportunity.apply_url,
        category: opportunity.category,
        event_date: opportunity.event_date || null,
        registration_deadline: opportunity.registration_deadline || null,
        program_duration: opportunity.program_duration || null,
        updated_at: new Date().toISOString(),
        status: 'Published' // default active state
      };

      if (existing) {
        // Update existing record
        const { error: updateError } = await this.db
          .from('opportunities')
          .update(payload)
          .eq('id', existing.id);
          
        if (updateError) throw updateError;
        return 'updated';
      } else {
        // Insert new record safely
        const { error: insertError } = await this.db
          .from('opportunities')
          .insert([payload]);
          
        if (insertError) throw insertError;
        return 'inserted';
      }
    } catch (err) {
      console.error(`[Upsert Failed] ${opportunity.title}:`, err);
      return 'error';
    }
  }
}
