import { fetchWithRetry } from '../utils/fetchWithRetry';

/**
 * MaintenanceService — Standalone maintenance layer for Opportunity Radar.
 *
 * Responsibilities:
 *   1. Deadline-based expiration: marks opportunities with a past deadline as Expired.
 *   2. Freshness verification: probes apply_url for HTTP 404/410 and expires dead links.
 *   3. Ingestion log: writes a structured run record to `ingestion_logs` with full metrics.
 *
 * This service is intentionally decoupled from the ingestion pipeline so that it can be
 * scheduled independently (e.g., daily vs hourly) without any overlap or shared state.
 */
export class MaintenanceService {
  /** Supabase client with the service-role key (bypasses RLS). */
  private db: any;

  /**
   * Number of active opportunities to sample per run for URL freshness checks.
   * Kept at 50 to avoid hammering external domains and stay within Vercel function timeouts.
   */
  private readonly FRESHNESS_SAMPLE_SIZE = 50;

  /**
   * HTTP status codes that indicate a link is permanently dead.
   */
  private readonly DEAD_LINK_STATUSES = new Set([404, 410]);

  constructor(dbClient: any) {
    if (!dbClient) {
      throw new Error(
        '[MaintenanceService] A Supabase client with SUPABASE_SERVICE_ROLE_KEY is required.'
      );
    }
    this.db = dbClient;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Execute the full maintenance routine.
   * Returns a metrics object that is also written to `ingestion_logs`.
   */
  async run(): Promise<MaintenanceRunResult> {
    const startTime = Date.now();
    const runTimestamp = new Date().toISOString();

    console.log(`[Maintenance] Run started at ${runTimestamp}`);

    let deadlineExpired = 0;
    let freshnessExpired = 0;
    let freshnessChecked = 0;
    let deadlineFailed = 0;
    let freshnessFailed = 0;
    // The reason each step failed, not just that one did. Without this the
    // log only ever said "1 maintenance step(s) encountered errors. Check
    // server logs." — which is why DATA-05 recurred three times undiagnosed:
    // every run since this service shipped has been PARTIAL, and the row that
    // recorded it never said which half broke or why. Vercel's function logs
    // roll off long before anyone reads them; the ingestion_log row does not.
    const stepErrors: string[] = [];

    // Step 1 — Deadline expiration
    try {
      deadlineExpired = await this.expireByDeadline(runTimestamp);
      console.log(`[Maintenance] Deadline expiration complete. Expired: ${deadlineExpired}`);
    } catch (err: any) {
      deadlineFailed = 1;
      stepErrors.push(`deadline_expiration: ${err?.message ?? String(err)}`);
      console.error('[Maintenance] Deadline expiration step failed:', err.message);
    }

    // Step 2 — Freshness / URL verification
    try {
      const freshnessResult = await this.verifyFreshness(runTimestamp);
      freshnessExpired = freshnessResult.expired;
      freshnessChecked = freshnessResult.checked;
      console.log(
        `[Maintenance] Freshness check complete. Checked: ${freshnessChecked}, Dead links found: ${freshnessExpired}`
      );
    } catch (err: any) {
      freshnessFailed = 1;
      stepErrors.push(`freshness_verification: ${err?.message ?? String(err)}`);
      console.error('[Maintenance] Freshness verification step failed:', err.message);
    }

    const durationMs = Date.now() - startTime;
    const totalExpired = deadlineExpired + freshnessExpired;
    const totalFailed = deadlineFailed + freshnessFailed;

    const result: MaintenanceRunResult = {
      runTimestamp,
      durationMs,
      deadlineExpired,
      freshnessChecked,
      freshnessExpired,
      totalExpired,
      failed: totalFailed,
      stepErrors,
    };

    // Step 3 — Log to ingestion_logs
    await this.writeLog(result);

    console.log(`[Maintenance] Run complete in ${durationMs}ms. Total expired: ${totalExpired}`);

    return result;
  }

  // ── Private Steps ────────────────────────────────────────────────────────────

  /**
   * Step 1: Mark any Published/Closing Soon opportunity whose deadline has already
   * passed as Expired. Returns the count of rows updated.
   */
  private async expireByDeadline(now: string): Promise<number> {
    const { data, error } = await this.db
      .from('opportunities')
      .update({ status: 'Expired', updated_at: now })
      .in('status', ['Published', 'Closing Soon'])
      .not('deadline', 'is', null)
      .lt('deadline', now)
      .select('id');

    if (error) {
      throw new Error(`Supabase update failed (deadline expiration): ${error.message}`);
    }

    return data?.length ?? 0;
  }

  /**
   * Step 2: Sample up to FRESHNESS_SAMPLE_SIZE published opportunities, probe
   * each apply_url via HTTP HEAD. Any URL returning 404 or 410 is marked Expired.
   */
  private async verifyFreshness(now: string): Promise<{ checked: number; expired: number }> {
    // Random-ish sampling: order by last_verified_at ASC so the oldest-checked rows
    // are prioritised each run. Falls back to created_at ordering if that column is null.
    const { data: opps, error } = await this.db
      .from('opportunities')
      .select('id, title, apply_url')
      .eq('status', 'Published')
      .order('last_verified_at', { ascending: true, nullsFirst: true })
      .limit(this.FRESHNESS_SAMPLE_SIZE);

    if (error) {
      throw new Error(`Supabase select failed (freshness sample): ${error.message}`);
    }

    if (!opps || opps.length === 0) {
      return { checked: 0, expired: 0 };
    }

    let expired = 0;
    const verifiedAt = now;

    for (const opp of opps) {
      try {
        // We intentionally use HEAD with a 4 second timeout to keep the run fast.
        // fetchWithRetry returns the response even on 404/410 (see its implementation).
        const response = await fetchWithRetry(
          opp.apply_url,
          { method: 'HEAD' },
          { maxRetries: 1, timeoutMs: 4000 }
        );

        if (this.DEAD_LINK_STATUSES.has(response.status)) {
          console.log(`[Maintenance] Dead link (${response.status}): ${opp.title} — ${opp.apply_url}`);
          await this.db
            .from('opportunities')
            .update({ status: 'Expired', updated_at: verifiedAt, last_verified_at: verifiedAt })
            .eq('id', opp.id);
          expired++;
        } else {
          // Still alive — update last_verified_at so this row moves to the back of the queue.
          await this.db
            .from('opportunities')
            .update({ last_verified_at: verifiedAt })
            .eq('id', opp.id);
        }
      } catch (_err) {
        // Timeout or DNS failure: we do NOT expire — network errors are transient.
        // The row will be retried on the next maintenance run (oldest last_verified_at first).
      }
    }

    return { checked: opps.length, expired };
  }

  /**
   * Step 3: Write a structured log entry to `ingestion_logs`.
   * Uses the provider name "MaintenanceService" to distinguish from ingestion runs.
   */
  private async writeLog(result: MaintenanceRunResult): Promise<void> {
    try {
      const { error } = await this.db.from('ingestion_logs').insert({
        provider: 'MaintenanceService',
        // Map maintenance-specific metrics to the existing schema columns:
        records_processed: result.freshnessChecked,          // URLs verified
        records_inserted: 0,                                  // maintenance never inserts
        records_updated: result.totalExpired,                 // opportunities marked Expired
        records_rejected: result.freshnessExpired,            // dead links found
        records_skipped_dup: result.deadlineExpired,          // deadline-expired count
        execution_time_ms: result.durationMs,
        status: result.failed > 0 ? 'PARTIAL' : 'SUCCESS',
        error_message: result.failed > 0
          // The actual reasons, capped so one enormous driver error cannot
          // fail the insert that is meant to record it.
          ? result.stepErrors.join(' | ').slice(0, 1000)
            || `${result.failed} maintenance step(s) encountered errors.`
          : null,
      });

      if (error) {
        console.error('[Maintenance] Failed to write ingestion_log:', error.message);
      } else {
        console.log('[Maintenance] Ingestion log written successfully.');
      }
    } catch (err: any) {
      console.error('[Maintenance] Exception writing log:', err.message);
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MaintenanceRunResult {
  runTimestamp: string;
  durationMs: number;
  deadlineExpired: number;
  freshnessChecked: number;
  freshnessExpired: number;
  totalExpired: number;
  failed: number;
  /** Per-step failure reasons, empty when every step succeeded. */
  stepErrors: string[];
}
