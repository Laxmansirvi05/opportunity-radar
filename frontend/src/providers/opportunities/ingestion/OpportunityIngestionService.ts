import { OpportunityProvider } from '../base/OpportunityProvider';
import { OpportunityValidator, ValidationResult } from '../validation/OpportunityValidator';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { SkillExtractor } from '../utils/SkillExtractor';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { detectSynthetic, describeVerdict } from '@/lib/ingestion/synthetic-detector';
import { canonicalizeUrl } from '@/lib/ingestion/canonical-url';
import { classifyGeo } from '@/lib/ingestion/geo';
import { reconcileUnseen, deleteExpiredOpportunities, type Db } from '@/lib/ingestion/reconciliation';

export interface IngestionStats {
  processed: number;
  valid: number;
  upserted: number;
  /** Rows created this run. */
  inserted: number;
  /** Rows already present that were refreshed this run. A healthy nightly run
   *  is mostly updates; a run reporting zero updates means refresh is broken. */
  updated: number;
  skipped_dup: number;
  /** Rejected because their geography puts them out of reach of an India-based student. */
  skipped_geo: number;
  /** Publishable internationally, but held back to keep the India-weighted mix. */
  skipped_quota: number;
  /** Deleted this run: past deadline, or no longer advertised by the source. */
  removed: number;
  errors: number;
}

/** A run that was refused before doing any work (kill switch off). */
export interface PipelineDisabledResult {
  status: 'disabled';
  reason: string;
}

/** A run that actually executed, with its per-run counters. */
export type PipelineCompletedResult = IngestionStats & { status: 'completed' };

export type PipelineResult = PipelineDisabledResult | PipelineCompletedResult;

export function isPipelineDisabled(
  result: PipelineResult
): result is PipelineDisabledResult {
  return result.status === 'disabled';
}

/** Ceiling on the share of the live catalogue that may be non-India. */
export const MAX_INTERNATIONAL_SHARE = 0.15;

const EMPTY_PROVIDER_STATS = {
  processed: 0,
  inserted: 0,
  updated: 0,
  skipped_dup: 0,
  errors: 0,
};

export class OpportunityIngestionService {
  private providers: OpportunityProvider[];
  private db: any;
  private fingerprintSet: Set<string> = new Set();
  private urlSet: Set<string> = new Set();
  /**
   * "source:source_id" for every opportunity already in the database.
   *
   * This is what distinguishes "a listing we already own, coming back for a
   * refresh" from "a different provider advertising the same job". The former
   * must be UPDATED; only the latter is a duplicate worth skipping.
   */
  private knownSourceKeys: Set<string> = new Set();
  /** Rows already stored per source before this run — the denominator for the
   *  coverage guard that prevents a partial scrape from deleting a catalogue. */
  private previousPerSource: Map<string, number> = new Map();
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

  /**
   * Current India vs international split of the live catalogue, used to seed
   * the publishing quota so it reflects reality rather than this run alone.
   */
  private async loadGeoBudget(): Promise<{ india: number; intl: number }> {
    const nowIso = new Date().toISOString();
    const live = (q: any) => q
      .in('status', ['Published', 'Closing Soon'])
      .or(`deadline.is.null,deadline.gte.${nowIso}`);

    try {
      const [inRes, intlRes] = await Promise.all([
        live(this.db.from('opportunities').select('id', { count: 'exact', head: true })).eq('country', 'IN'),
        live(this.db.from('opportunities').select('id', { count: 'exact', head: true })).neq('country', 'IN'),
      ]);
      const india = inRes?.count ?? 0;
      const intl = intlRes?.count ?? 0;
      console.log(`[Ingestion] Geo budget seeded from live catalogue: ${india} India / ${intl} international.`);
      return { india, intl };
    } catch (e) {
      console.warn('[Ingestion] Could not seed geo budget; starting from zero.', e);
      return { india: 0, intl: 0 };
    }
  }

  /** Stable identity of a listing within the provider it came from. */
  private sourceKey(source: string | null | undefined, sourceId: string | null | undefined): string {
    return `${(source ?? '').toLowerCase()}:${sourceId ?? ''}`;
  }

  /**
   * Load every existing opportunity into the in-memory dedupe indexes.
   *
   * Paginated deliberately: PostgREST caps an unbounded select at 1000 rows,
   * so the previous single-shot query silently indexed only a fraction of the
   * table once the catalogue grew past that. Anything beyond the cap was
   * invisible to deduplication.
   */
  private async loadExistingIndex(): Promise<number> {
    const PAGE_SIZE = 1000;
    let from = 0;
    let loaded = 0;

    for (;;) {
      const { data, error } = await this.db
        .from('opportunities')
        .select('title, company_name, apply_url, source, source_id')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[Ingestion] Failed to preload existing opportunities:', error);
        break;
      }

      const rows = data ?? [];
      for (const record of rows) {
        if (record.title && record.company_name) {
          this.fingerprintSet.add(this.generateFingerprint(record.title, record.company_name));
        }
        if (record.apply_url) {
          this.urlSet.add(record.apply_url.toLowerCase());
        }
        if (record.source && record.source_id) {
          this.knownSourceKeys.add(this.sourceKey(record.source, record.source_id));
        }
        if (record.source) {
          const key = String(record.source).toLowerCase();
          this.previousPerSource.set(key, (this.previousPerSource.get(key) ?? 0) + 1);
        }
      }

      loaded += rows.length;
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    console.log(
      `[Ingestion] Indexed ${loaded} existing opportunities ` +
      `(${this.knownSourceKeys.size} with a source key, ${this.fingerprintSet.size} fingerprints).`
    );
    return loaded;
  }

  /**
   * The ingestion kill switch.
   *
   * In production the pipeline refuses to run unless ENABLE_OPP_INGESTION is
   * explicitly 'true'. This is deliberate — it stops a misconfigured deploy from
   * scraping third-party sites. Outside production, and for dry runs, it is a
   * no-op so local development and tests work without extra setup.
   */
  public static isIngestionEnabled(dryRun: boolean = false): boolean {
    if (dryRun) return true;
    if (process.env.NODE_ENV !== 'production') return true;
    return process.env.ENABLE_OPP_INGESTION === 'true';
  }

  async runPipeline(dryRun: boolean = false): Promise<PipelineResult> {
    if (!OpportunityIngestionService.isIngestionEnabled(dryRun)) {
      const reason =
        'Ingestion is disabled: ENABLE_OPP_INGESTION is not set to "true" in this environment. ' +
        'No opportunities were fetched, added, updated or expired.';

      console.error(`[Ingestion] ABORTED — ${reason}`);

      // Record the skipped run so it is visible in /api/cron/health and in
      // ingestion_logs. Previously this returned quietly and the cron endpoint
      // still reported success, which is why the pipeline could sit switched
      // off for weeks without anyone noticing.
      await this.logRun('ConfigurationGuard', EMPTY_PROVIDER_STATS, 'DISABLED', reason, 0);

      return { status: 'disabled', reason };
    }

    const runStartedAt = new Date().toISOString();
    /** Records this run confirmed still live, per source. */
    const seenPerSource = new Map<string, number>();

    // ── India-weighted publishing quota ──────────────────────────────────
    // Applied as a running budget against the LIVE catalogue rather than per
    // batch: a batch that happens to be entirely international must not still
    // admit its own 15%, or the mix drifts with every run. India listings are
    // never blocked — only international ones are rate-limited.
    const geoBudget = await this.loadGeoBudget();
    const globalStats = { processed: 0, valid: 0, upserted: 0, inserted: 0, updated: 0, skipped_dup: 0, skipped_geo: 0, skipped_quota: 0, removed: 0, errors: 0 };

    // Pre-load existing records to prevent cross-source dupes, and to recognise
    // our own listings when they come back for a refresh.
    await this.loadExistingIndex();

    for (const provider of this.providers) {
      const startTime = Date.now();
      const providerStats = { processed: 0, inserted: 0, updated: 0, skipped_dup: 0, errors: 0 };
      const providerName = provider.constructor.name;
      
      try {
        const rawData = await provider.fetch();

        // ── Gate 2: batch-level fabrication check ────────────────────────
        // A provider that invents data invents all of it, so the whole payload
        // is rejected rather than filtered record by record.
        const normalizedBatch = rawData.map((raw: unknown) => {
          try { return provider.normalize(raw); } catch { return null; }
        }).filter((nb): nb is NormalizedOpportunity => nb !== null).map((nb) => ({
          title: nb.title, company: nb.company, description: nb.description,
          apply_url: nb.apply_url, source_id: nb.source_id,
        }));

        const verdict = detectSynthetic(normalizedBatch);
        if (verdict.isSynthetic) {
          const reason = `Rejected ${rawData.length} records from ${providerName} as fabricated — ${describeVerdict(verdict)}`;
          console.error(`[Ingestion] SYNTHETIC DATA REJECTED: ${reason}`);
          await this.logRun(providerName, { ...EMPTY_PROVIDER_STATS, processed: rawData.length, errors: rawData.length }, 'REJECTED_SYNTHETIC', reason, Date.now() - startTime);
          globalStats.errors += rawData.length;
          continue;
        }

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

          // ── Gate 4: geography ─────────────────────────────────────────
          // India-first: an international on-site role is not actionable for
          // the students this product serves.
          const geo = classifyGeo(normalized.location, {
            title: normalized.title,
            mode: normalized.mode,
            source: normalized.source,
          });
          if (!geo.publishable) {
            globalStats.skipped_geo++;
            continue;
          }

          // The quota governs ADMISSION of new listings, not the survival of
          // existing ones. A listing already published and still advertised by
          // its source must keep flowing through to upsert(), or it will miss
          // its last_seen_at stamp and be deleted by reconciliation — then
          // re-added on a later run, churning the catalogue.
          const alreadyPublished = this.knownSourceKeys.has(
            this.sourceKey(normalized.source, normalized.source_id)
          );

          if (geo.country === 'IN') {
            geoBudget.india++;
          } else if (alreadyPublished) {
            geoBudget.intl++;
          } else {
            // Would admitting this NEW listing push international past the cap?
            const projected = (geoBudget.intl + 1) / (geoBudget.india + geoBudget.intl + 1);
            if (projected > MAX_INTERNATIONAL_SHARE) {
              globalStats.skipped_quota++;
              continue;
            }
            geoBudget.intl++;
          }

          // Duplicate Protection (Fingerprint + Exact URL)
          const fingerprint = this.generateFingerprint(normalized.title, normalized.company);
          const urlLower = normalized.apply_url.toLowerCase();
          const sourceKey = this.sourceKey(normalized.source, normalized.source_id);

          // A listing we already store, returning from the same provider, is a
          // REFRESH — not a duplicate. It has to reach upsert() so changed
          // deadlines, descriptions and closures actually land.
          //
          // This check must come first: the fingerprint and URL of an existing
          // record are (by definition) already in the sets below, so testing
          // those first would skip every returning listing and the database
          // would never move after the first run. That was the bug.
          const isRefreshOfOwnRecord = this.knownSourceKeys.has(sourceKey);

          if (!isRefreshOfOwnRecord && (this.fingerprintSet.has(fingerprint) || this.urlSet.has(urlLower))) {
             console.log(`[Duplicate Skipped] ${normalized.company} - ${normalized.title}`);
             globalStats.skipped_dup++;
             providerStats.skipped_dup++;
             continue;
          }

          // Track within this run so two providers in the same batch cannot
          // both insert the same job.
          this.fingerprintSet.add(fingerprint);
          this.urlSet.add(urlLower);
          this.knownSourceKeys.add(sourceKey);

          // Enrichment: Automatic Skill Extraction
          const extractedSkills = SkillExtractor.extract(normalized.description || '');
          normalized.skills = Array.from(new Set([...(normalized.skills || []), ...extractedSkills]));

          if (dryRun) {
            // Simulate the upsert, attributing it the way a real run would.
            globalStats.upserted++;
            if (isRefreshOfOwnRecord) {
              globalStats.updated++;
              providerStats.updated++;
            } else {
              globalStats.inserted++;
              providerStats.inserted++;
            }
            continue;
          }

          const upsertResult = await this.upsert(normalized, runStartedAt);
          if (upsertResult.status === 'inserted' || upsertResult.status === 'updated') {
            globalStats.upserted++;
            const srcKey = String(normalized.source ?? '').toLowerCase();
            seenPerSource.set(srcKey, (seenPerSource.get(srcKey) ?? 0) + 1);
            if (upsertResult.status === 'inserted') {
              globalStats.inserted++;
              providerStats.inserted++;
            } else {
              globalStats.updated++;
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
      // ── Auto-removal, run every cycle ───────────────────────────────────
      // 1. Anything past its deadline is deleted outright (students never see
      //    something they cannot act on, and storage is not spent on it).
      const expiredResult = await deleteExpiredOpportunities(this.db as Db, runStartedAt);
      globalStats.removed += expiredResult.deleted;
      console.log(`[Ingestion] Deadline sweep: ${expiredResult.reason}`);

      // 2. Anything this run did not see is no longer advertised by its source
      //    and is deleted too — guarded so a partial scrape cannot empty a source.
      for (const [source, seen] of seenPerSource) {
        const previous = this.previousPerSource.get(source) ?? 0;
        const r = await reconcileUnseen(this.db as Db, source, runStartedAt, seen, previous);
        globalStats.removed += r.deleted;
        console.log(`[Ingestion] Reconcile ${source}: ${r.reason}`);
      }

      // 3. Dead-link sweep (unchanged).
      await this.expireOpportunities();
    }

    return { status: 'completed', ...globalStats };
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

  public async upsert(opportunity: NormalizedOpportunity, runStartedAt?: string): Promise<{ status: 'inserted' | 'updated' | 'error', id?: string }> {
    try {
      // Handle Company ID lookup and insertion safely without altering external relationships
      const companyId = await this.upsertCompany(opportunity.company, opportunity.company_logo_url);

      const geo = classifyGeo(opportunity.location, {
        title: opportunity.title,
        mode: opportunity.mode,
        source: opportunity.source,
      });

      const { data: existing, error: selectError } = await this.db
        .from('opportunities')
        .select('id, posted_at')
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
        posted_at: opportunity.posted_at || existing?.posted_at || null,
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
        status: 'Published',
        // Provenance: proves the source still advertises this listing on this
        // run. Reconciliation deletes anything a complete run did not stamp.
        last_seen_at: runStartedAt ?? new Date().toISOString(),
        canonical_url: canonicalizeUrl(opportunity.apply_url),
        country: geo.country,
        is_remote: geo.isRemote,
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
