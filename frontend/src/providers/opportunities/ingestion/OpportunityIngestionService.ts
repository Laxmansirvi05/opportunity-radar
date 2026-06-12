import { OpportunityProvider } from '../base/OpportunityProvider';
import { OpportunityValidator, ValidationResult } from '../validation/OpportunityValidator';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { SkillExtractor } from '../utils/SkillExtractor';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export class OpportunityIngestionService {
  private providers: OpportunityProvider[];
  private db: any;
  private fingerprintSet: Set<string> = new Set();
  private urlSet: Set<string> = new Set();
  private companyCache: Map<string, string> = new Map();

  constructor(providers: OpportunityProvider[], dbClient: any) {
    if (!dbClient) {
      throw new Error(
        '[OpportunityIngestionService] A Supabase client must be provided. ' +
        'Pass a client created with SUPABASE_SERVICE_ROLE_KEY to bypass RLS.'
      );
    }
    this.providers = providers;
    this.db = dbClient;
  }

  private generateFingerprint(title: string, company: string): string {
    const normalizeString = (str: string) => 
      str.toLowerCase()
         .replace(/\(.*\)/g, '')
         .replace(/\b(intern|internship|role|at|inc|llc|ltd)\b/g, '')
         .replace(/[^a-z0-9]/g, '')
         .trim();
    return `${normalizeString(company)}:${normalizeString(title)}`;
  }

  async runPipeline(dryRun: boolean = false) {
    if (process.env.ENABLE_OPP_INGESTION !== 'true' && process.env.NODE_ENV === 'production' && !dryRun) {
      console.warn('Ingestion disabled via feature flag ENABLE_OPP_INGESTION. Exiting.');
      return { status: 'disabled' };
    }

    let globalStats = { processed: 0, valid: 0, upserted: 0, skipped_dup: 0, errors: 0 };

    // Pre-load existing records to prevent cross-source dupes
    const { data: existingRecords } = await this.db.from('opportunities').select('title, company_name, apply_url');
    if (existingRecords) {
      existingRecords.forEach((record: any) => {
        if (record.title && record.company_name) {
          this.fingerprintSet.add(this.generateFingerprint(record.title, record.company_name));
        }
        if (record.apply_url) {
          this.urlSet.add(record.apply_url.toLowerCase());
        }
      });
    }

    for (const provider of this.providers) {
      const startTime = Date.now();
      let providerStats = { processed: 0, inserted: 0, updated: 0, skipped_dup: 0, errors: 0 };
      let providerName = provider.constructor.name;
      
      try {
        const rawData = await provider.fetch();
        
        for (const raw of rawData) {
          globalStats.processed++;
          providerStats.processed++;
          
          const normalized = provider.normalize(raw);
          const validationResult: ValidationResult = OpportunityValidator.validate(normalized);
          
          if (!validationResult.isValid) {
            console.warn(`[Validation Failed] ${normalized.title}:`, validationResult.errors);
            globalStats.errors++;
            providerStats.errors++;
            continue;
          }
          
          globalStats.valid++;

          // Duplicate Protection (Fingerprint + Exact URL)
          const fingerprint = this.generateFingerprint(normalized.title, normalized.company);
          const urlLower = normalized.apply_url.toLowerCase();

          if (this.fingerprintSet.has(fingerprint) || this.urlSet.has(urlLower)) {
             console.log(`[Duplicate Skipped] ${normalized.company} - ${normalized.title}`);
             globalStats.skipped_dup++;
             providerStats.skipped_dup++;
             continue;
          }
          
          this.fingerprintSet.add(fingerprint);
          this.urlSet.add(urlLower);

          // Enrichment: Automatic Skill Extraction
          const extractedSkills = SkillExtractor.extract(normalized.description || '');
          normalized.skills = Array.from(new Set([...(normalized.skills || []), ...extractedSkills]));

          if (dryRun) {
            // Simulate Upsert
            globalStats.upserted++;
            providerStats.inserted++;
            continue;
          }

          const upsertResult = await this.upsert(normalized);
          if (upsertResult.status === 'inserted' || upsertResult.status === 'updated') {
            if (upsertResult.status === 'inserted') {
              globalStats.upserted++;
              providerStats.inserted++;
            } else {
              globalStats.upserted++;
              providerStats.updated++;
            }

            // Write tags to opportunity_tags table
            if (upsertResult.id && normalized.skills && normalized.skills.length > 0) {
               const tagsPayload = normalized.skills.map((skill: string) => ({
                 opportunity_id: upsertResult.id,
                 tag_name: skill.trim()
               })).filter((t: any) => t.tag_name.length > 0);
               
               if (tagsPayload.length > 0) {
                 const { error: tagsError } = await this.db.from('opportunity_tags')
                   .upsert(tagsPayload, { onConflict: 'opportunity_id,tag_name' });
                 if (tagsError) {
                   console.error(`Failed to insert tags for ${normalized.title}:`, tagsError);
                 }
               }
            }

          } else {
            globalStats.errors++;
            providerStats.errors++;
          }
        }
        
        await this.logRun(providerName, providerStats, 'SUCCESS', null, Date.now() - startTime);

      } catch (error: any) {
        console.error(`Pipeline error for provider:`, error);
        await this.logRun(providerName, providerStats, 'FAILED', error.message || 'Unknown error', Date.now() - startTime);
      }
    }

    if (!dryRun) {
      // Handle Expiration & Freshness Tracking
      await this.expireOpportunities();
    }

    return globalStats;
  }

  private async upsertCompany(companyName: string, logoUrl?: string): Promise<string | null> {
    if (!companyName) return null;
    
    // Check in-memory cache
    const cacheKey = companyName.toLowerCase();
    if (this.companyCache.has(cacheKey)) {
      return this.companyCache.get(cacheKey)!;
    }

    // Lookup company in DB
    const { data: existingCompany, error: findError } = await this.db
      .from('companies')
      .select('id, logo_url')
      .ilike('name', companyName)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding company:', findError);
      return null;
    }

    if (existingCompany) {
      // Automatic logo enrichment for existing companies
      if (!existingCompany.logo_url && logoUrl) {
        await this.db.from('companies').update({ logo_url: logoUrl }).eq('id', existingCompany.id);
      }
      this.companyCache.set(cacheKey, existingCompany.id);
      return existingCompany.id;
    }

    // Automatic Company Creation
    const { data: newCompany, error: insertError } = await this.db
      .from('companies')
      .insert({ name: companyName, logo_url: logoUrl || null })
      .select('id')
      .single();

    if (insertError || !newCompany) {
      console.error('Error inserting company:', insertError);
      return null;
    }

    this.companyCache.set(cacheKey, newCompany.id);
    return newCompany.id;
  }

  private async upsert(opportunity: NormalizedOpportunity): Promise<{ status: 'inserted' | 'updated' | 'error', id?: string }> {
    try {
      // Handle Company ID lookup and insertion safely without altering external relationships
      const companyId = await this.upsertCompany(opportunity.company, opportunity.company_logo_url);

      const { data: existing, error: selectError } = await this.db
        .from('opportunities')
        .select('id')
        .eq('source', opportunity.source)
        .eq('source_id', opportunity.source_id)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') throw selectError;

      const payload = {
        title: opportunity.title,
        company_name: opportunity.company,
        company_id: companyId, // newly enriched
        location: opportunity.location,
        description: opportunity.description,
        skills: opportunity.skills || [],
        requirements: opportunity.requirements || [],
        deadline: opportunity.deadline,
        source: opportunity.source,
        source_id: opportunity.source_id,
        apply_url: opportunity.apply_url,
        category: opportunity.category,
        event_date: opportunity.event_date || null,
        registration_deadline: opportunity.registration_deadline || null,
        program_duration: opportunity.program_duration || null,
        source_url: opportunity.source_url || null,
        mode: opportunity.mode || null,
        is_paid: opportunity.is_paid ?? null,
        salary_range: opportunity.salary_range || null,
        verified: opportunity.verified ?? null,
        experience_level: opportunity.experience_level || null,
        updated_at: new Date().toISOString(),
        status: 'Published'
      };

      if (existing) {
        const { error: updateError } = await this.db.from('opportunities').update(payload).eq('id', existing.id);
        if (updateError) throw updateError;
        return { status: 'updated', id: existing.id };
      } else {
        const { data: inserted, error: insertError } = await this.db.from('opportunities').insert([payload]).select('id').single();
        if (insertError) throw insertError;
        return { status: 'inserted', id: inserted?.id };
      }
    } catch (err) {
      console.error(`[Upsert Failed] ${opportunity.title}:`, err);
      return { status: 'error' };
    }
  }

  private async expireOpportunities() {
    try {
      const now = new Date().toISOString();
      
      // 1. Time-based Expiration
      await this.db
        .from('opportunities')
        .update({ status: 'Expired', updated_at: now })
        .in('status', ['Published', 'Closing Soon'])
        .not('deadline', 'is', null)
        .lt('deadline', now);
        
      // 2. Link Verification (Freshness tracking)
      // Check 50 random published opportunities per run to ensure links are alive
      const { data: activeOpps } = await this.db
        .from('opportunities')
        .select('id, apply_url')
        .eq('status', 'Published')
        .limit(50);
        
      if (activeOpps && activeOpps.length > 0) {
        let brokenCount = 0;
        for (const opp of activeOpps) {
          try {
            const res = await fetchWithRetry(opp.apply_url, { method: 'HEAD' }, { maxRetries: 1, timeoutMs: 3000 });
            if (res.status === 404 || res.status === 410) {
              await this.db.from('opportunities').update({ status: 'Expired', updated_at: now }).eq('id', opp.id);
              brokenCount++;
            }
          } catch (e) {
             // Silently ignore timeout errors on verification
          }
        }
        console.log(`Successfully ran freshness tracking. Expired ${brokenCount} broken links.`);
      }
    } catch (e) {
      console.error('Error running expiration routine:', e);
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
}
