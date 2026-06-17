

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

    const BATCH_SIZE = 200;

    for (const provider of this.providers) {
      const startTime = Date.now();
      let providerStats = { processed: 0, inserted: 0, updated: 0, skipped_dup: 0, errors: 0 };
      let providerName = provider.constructor.name;
      let payloadBatch: any[] = [];

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

          // 5. Add to Batch
          const payload = {
            title: normalized.title,
            company_name: normalized.company, // mapped to denormalized company_name
            location: normalized.location,
            description: normalized.description,
            requirements: normalized.skills || [],
            deadline: normalized.deadline,
            source: normalized.source,
            source_id: normalized.source_id,
            apply_url: normalized.apply_url,
            category: normalized.category,
            event_date: normalized.event_date || null,
            registration_deadline: normalized.registration_deadline || null,
            program_duration: normalized.program_duration || null,
            updated_at: new Date().toISOString(),
            status: 'Published' // default active state
          };

          payloadBatch.push(payload);

          // Flush batch if size reached
          if (payloadBatch.length >= BATCH_SIZE) {
            await this.flushBatch(providerName, payloadBatch, globalStats, providerStats);
            payloadBatch = []; // Reset batch
          }
        }

        // Flush remaining records in the batch
        if (payloadBatch.length > 0) {
          await this.flushBatch(providerName, payloadBatch, globalStats, providerStats);
          payloadBatch = [];
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

  private async flushBatch(providerName: string, batch: any[], globalStats: any, providerStats: any) {
    if (batch.length === 0) return;

    try {
      // 1. Identify which records are existing vs new to preserve accurate logging
      const sourceIds = batch.map(p => p.source_id);
      
      const { data: existingRecords, error: selectError } = await this.db
        .from('opportunities')
        .select('source_id')
        .in('source_id', sourceIds)
        .eq('source', batch[0].source); // assuming all items in batch are from the same provider

      if (selectError) throw selectError;

      const existingSet = new Set((existingRecords || []).map((r: any) => r.source_id));

      let batchInserted = 0;
      let batchUpdated = 0;

      for (const p of batch) {
        if (existingSet.has(p.source_id)) {
          batchUpdated++;
        } else {
          batchInserted++;
        }
      }

      // 2. Perform bulk upsert
      const { error: upsertError } = await this.db
        .from('opportunities')
        .upsert(batch, { onConflict: 'source, source_id' });

      if (upsertError) throw upsertError;

      // 3. Update stats if successful
      globalStats.upserted += batch.length;
      providerStats.inserted += batchInserted;
      providerStats.updated += batchUpdated;
      
    } catch (err) {
      console.error(`[Batch Upsert Failed] for ${providerName} (size ${batch.length}):`, err);
      globalStats.errors += batch.length;
      providerStats.errors += batch.length;
    }
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
}
