import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

/**
 * Direct-from-employer ingestion.
 *
 * Most companies run their careers page on a hosted ATS that exposes a public,
 * documented JSON endpoint. Reading those gives listings straight from the
 * employer, with an apply link on the employer's own domain — no scraping, no
 * third-party aggregator in between, and no risk of the fabricated data that
 * the deleted providers produced.
 *
 * Employers are configuration, not code: boards are read from the
 * `source_registry` table, so adding a company is one row rather than a new
 * class. Boards that repeatedly fail are deactivated automatically.
 */

export type AtsKind = 'greenhouse' | 'lever' | 'smartrecruiters';

/** Minimal shape of the Supabase client this provider needs. The builder is
 *  chainable and thenable; typing it recursively avoids coupling to a specific
 *  supabase-js version. */
export interface RegistryChain {
  select: (cols?: string) => RegistryChain
  update: (payload: Record<string, unknown>) => RegistryChain
  eq: (col: string, val: unknown) => RegistryChain
  range: (from: number, to: number) => RegistryChain
  maybeSingle: () => RegistryChain
  then: (resolve: (v: { data: Record<string, unknown>[] & Record<string, unknown> | null; error: { message?: string } | null }) => void) => void
}

export interface RegistryDb {
  from: (table: string) => RegistryChain
}

export interface RegistryEntry {
  id?: string;
  company_name: string;
  ats: AtsKind;
  slug: string;
  trust_tier?: number;
}

/** A raw posting tagged with the board it came from, so normalize() can route. */
interface TaggedRaw {
  _ats: AtsKind;
  _company: string;
  _slug: string;
  [key: string]: unknown;
}

/** Consecutive failures before a board is switched off in the registry. */
const DEACTIVATE_AFTER_FAILURES = 5;

/** Boards fetched at once. Kept low to stay a polite client of each ATS. */
const CONCURRENCY = 4;

const INTERN_HINT = /\b(intern|internship|trainee|apprentice|co-?op|summer analyst|graduate programme|graduate program)\b/i;

async function getJson(url: string, timeoutMs = 20000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export class AtsBoardProvider extends OpportunityProvider {
  private db: RegistryDb | null;
  private overrides: RegistryEntry[] | null;

  /**
   * @param db         Supabase service-role client, used to read the registry
   *                   and record per-board health.
   * @param overrides  Explicit board list, bypassing the registry (tests).
   */
  constructor(db: RegistryDb | null, overrides?: RegistryEntry[]) {
    super();
    this.db = db;
    this.overrides = overrides ?? null;
  }

  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(): Promise<unknown> {
    return {};
  }

  private async loadRegistry(): Promise<RegistryEntry[]> {
    if (this.overrides) return this.overrides;
    if (!this.db) return [];

    const { data, error } = await this.db
      .from('source_registry')
      .select('id, company_name, ats, slug, trust_tier')
      .eq('active', true)
      .range(0, 999);

    if (error) {
      console.error('[ATS] Could not read source_registry:', error.message ?? error);
      return [];
    }
    return (data ?? []) as RegistryEntry[];
  }

  private async recordHealth(entry: RegistryEntry, ok: boolean, message?: string): Promise<void> {
    if (!this.db || !entry.id) return;
    try {
      if (ok) {
        await this.db
          .from('source_registry')
          .update({ last_ok_at: new Date().toISOString(), consecutive_failures: 0, last_error: null })
          .eq('id', entry.id);
        return;
      }

      const { data } = await this.db
        .from('source_registry')
        .select('consecutive_failures')
        .eq('id', entry.id)
        .maybeSingle();

      const failures = ((data?.consecutive_failures as number) ?? 0) + 1;
      await this.db
        .from('source_registry')
        .update({
          consecutive_failures: failures,
          last_error: message ?? 'fetch failed',
          // A board that has failed this many times in a row has almost
          // certainly been renamed or retired; stop hammering it.
          active: failures < DEACTIVATE_AFTER_FAILURES,
        })
        .eq('id', entry.id);

      if (failures >= DEACTIVATE_AFTER_FAILURES) {
        console.warn(`[ATS] Deactivated ${entry.company_name} (${entry.ats}/${entry.slug}) after ${failures} consecutive failures.`);
      }
    } catch (e) {
      console.error('[ATS] Failed to record board health:', e);
    }
  }

  private async fetchBoard(entry: RegistryEntry): Promise<TaggedRaw[]> {
    const tag = (rows: unknown[]): TaggedRaw[] =>
      rows.map((r) => ({ ...(r as object), _ats: entry.ats, _company: entry.company_name, _slug: entry.slug } as TaggedRaw));

    let rows: unknown[] | null = null;

    if (entry.ats === 'greenhouse') {
      const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${entry.slug}/jobs?content=true`);
      rows = (d as { jobs?: unknown[] })?.jobs ?? null;
    } else if (entry.ats === 'lever') {
      const d = await getJson(`https://api.lever.co/v0/postings/${entry.slug}?mode=json`);
      rows = Array.isArray(d) ? d : null;
    } else if (entry.ats === 'smartrecruiters') {
      const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${entry.slug}/postings?limit=100`);
      rows = (d as { content?: unknown[] })?.content ?? null;
    }

    if (!rows) {
      await this.recordHealth(entry, false, `no postings returned from ${entry.ats}`);
      return [];
    }

    await this.recordHealth(entry, true);
    return tag(rows);
  }

  async fetch(): Promise<TaggedRaw[]> {
    const registry = await this.loadRegistry();
    if (registry.length === 0) {
      console.warn('[ATS] source_registry is empty — no employer boards to fetch.');
      return [];
    }

    console.log(`[ATS] Fetching ${registry.length} employer boards…`);
    const all: TaggedRaw[] = [];

    for (let i = 0; i < registry.length; i += CONCURRENCY) {
      const batch = registry.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((e) => this.fetchBoard(e)));
      for (const r of results) all.push(...r);
    }

    console.log(`[ATS] ${all.length} postings from ${registry.length} boards.`);
    return all;
  }

  normalize(raw: TaggedRaw): NormalizedOpportunity {
    switch (raw._ats) {
      case 'greenhouse':
        return this.normalizeGreenhouse(raw);
      case 'lever':
        return this.normalizeLever(raw);
      case 'smartrecruiters':
        return this.normalizeSmartRecruiters(raw);
      default:
        throw new Error(`Unsupported ATS: ${raw._ats}`);
    }
  }

  private categoryFor(title: string): string {
    return INTERN_HINT.test(title) ? 'Internship' : 'Job';
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeGreenhouse(raw: TaggedRaw): NormalizedOpportunity {
    const title = String(raw.title ?? '');
    const location = (raw.location as { name?: string })?.name ?? '';
    const content = raw.content ? this.stripHtml(String(raw.content)) : '';
    return {
      title,
      company: raw._company,
      location,
      description: content.slice(0, 5000),
      apply_url: String(raw.absolute_url ?? ''),
      source: 'greenhouse',
      source_id: String(raw.id ?? ''),
      category: this.categoryFor(title),
      deadline: (raw.application_deadline as string) ?? null,
      posted_at: (raw.first_published as string) ?? (raw.updated_at as string) ?? null,
      skills: [],
      requirements: [],
    } as NormalizedOpportunity;
  }

  private normalizeLever(raw: TaggedRaw): NormalizedOpportunity {
    const title = String(raw.text ?? '');
    const cat = raw.categories as { location?: string; team?: string; commitment?: string } | undefined;
    return {
      title,
      company: raw._company,
      location: cat?.location ?? '',
      description: String(raw.descriptionPlain ?? '').slice(0, 5000),
      apply_url: String(raw.hostedUrl ?? raw.applyUrl ?? ''),
      source: 'lever',
      source_id: String(raw.id ?? ''),
      category: this.categoryFor(`${title} ${cat?.commitment ?? ''}`),
      deadline: null,
      posted_at: raw.createdAt ? new Date(Number(raw.createdAt)).toISOString() : null,
      skills: [],
      requirements: [],
    } as NormalizedOpportunity;
  }

  private normalizeSmartRecruiters(raw: TaggedRaw): NormalizedOpportunity {
    const title = String(raw.name ?? '');
    const loc = raw.location as { city?: string; region?: string; country?: string } | undefined;
    const location = [loc?.city, loc?.region, loc?.country].filter(Boolean).join(', ');
    return {
      title,
      company: (raw.company as { name?: string })?.name ?? raw._company,
      location,
      description: '',
      apply_url: `https://jobs.smartrecruiters.com/${raw._slug}/${raw.id}`,
      source: 'smartrecruiters',
      source_id: String(raw.id ?? ''),
      category: this.categoryFor(title),
      deadline: null,
      posted_at: (raw.releasedDate as string) ?? null,
      skills: [],
      requirements: [],
    } as NormalizedOpportunity;
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return Boolean(opportunity.title && opportunity.apply_url && opportunity.source_id);
  }
}
