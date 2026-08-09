import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

/**
 * Unstop competitions, hackathons and student events.
 *
 * Unstop is India's largest student-competition platform and its public search
 * API exposes everything we need directly — organiser name and logo, prize
 * breakdown, registration deadline and a canonical seo_url — so no detail-page
 * scraping is required.
 *
 * Scope is deliberately India-only. Unstop's audience is Indian students, and
 * the product owner's rule for this category is 100% India: an online
 * competition on Unstop is open to Indian students, an explicitly foreign one
 * is not useful here.
 *
 * The API returns `total: 10000` across these categories. per_page=100 is
 * honoured, so a full sweep is ~100 requests rather than ~1000.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const PER_PAGE = 100;

/**
 * Every Unstop type worth surfacing to a student.
 *
 * Measured live with oppstatus=open: competitions 275, hackathons 111,
 * internships 882, jobs 1178, workshops 42, quizzes 38, conferences 17,
 * scholarships 6 — about 2,550 genuinely open listings. Unstop advertises
 * "21341+ competitions", but that counts closed archives; only the open ones
 * are useful and only those are ingested.
 */
const TYPES = [
  'competitions', 'hackathons', 'internships', 'jobs',
  'workshops', 'quizzes', 'conferences', 'scholarships',
] as const;

/** Maps an Unstop type to our category vocabulary. */
const CATEGORY: Record<string, string> = {
  hackathons: 'Hackathon',
  competitions: 'Competition',
  internships: 'Internship',
  jobs: 'Job',
  workshops: 'Workshop',
  quizzes: 'Competition',
  conferences: 'Workshop',
  scholarships: 'Scholarship',
};

/** Locations that mark a listing as explicitly outside India. */
const NON_INDIA = /\b(usa|united states|singapore|dubai|uae|london|uk|united kingdom|canada|australia|germany|france|japan|china|nepal|bangladesh|sri lanka|pakistan)\b/i;

interface UnstopOrg {
  name?: string;
  logoUrl?: string | null;
  public_url?: string | null;
}

interface UnstopPrize {
  rank?: string | null;
  cash?: string | number | null;
  others?: string | null;
}

interface UnstopItem {
  id?: number | string;
  title?: string;
  type?: string;
  subtype?: string | null;
  region?: string | null;
  seo_url?: string | null;
  public_url?: string | null;
  end_date?: string | null;
  start_date?: string | null;
  logoUrl2?: string | null;
  organisation?: UnstopOrg | null;
  prizes?: UnstopPrize[] | null;
  locations?: unknown;
  isPaid?: boolean | null;
  registerCount?: number | null;
  required_skills?: unknown;
  [k: string]: unknown;
}

type Tagged = UnstopItem & { _category: string };

async function getPage(type: string, page: number): Promise<UnstopItem[] | null> {
  // oppstatus=open is essential: without it the API returns its full archive,
  // of which the overwhelming majority have closed and are rejected downstream
  // as expired — 7,410 of 8,000 on the first attempt.
  const url =
    `https://unstop.com/api/public/opportunity/search-result` +
    `?opportunity=${type}&page=${page}&per_page=${PER_PAGE}&oppstatus=open`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { data?: UnstopItem[] } };
    return json?.data?.data ?? null;
  } catch {
    return null;
  }
}

export class UnstopCompetitionsProvider extends OpportunityProvider {
  /** Pages per type. Open listings top out around 1200 for the largest type. */
  private readonly maxPages: number;

  constructor(maxPages = 40) {
    super();
    this.maxPages = maxPages;
  }

  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(): Promise<unknown> {
    return {};
  }

  async fetch(): Promise<Tagged[]> {
    const out: Tagged[] = [];

    for (const type of TYPES) {
      let consecutiveEmpty = 0;

      for (let page = 1; page <= this.maxPages; page++) {
        const items = await getPage(type, page);

        // Stop early rather than burning the full page budget on empty tails.
        if (!items || items.length === 0) {
          if (++consecutiveEmpty >= 2) break;
          continue;
        }
        consecutiveEmpty = 0;

        for (const item of items) {
          if (!this.isIndian(item)) continue;
          out.push({ ...item, _category: CATEGORY[String(item.type ?? type)] ?? 'Competition' });
        }

        if (items.length < PER_PAGE) break;
      }

      console.log(`[Unstop/${type}] collected ${out.length} India listings so far.`);
    }

    return out;
  }

  /**
   * India-only. Unstop is an India-native platform, so the default is to accept;
   * a listing is excluded only when it names a location clearly outside India.
   */
  private isIndian(item: UnstopItem): boolean {
    const loc = JSON.stringify(item.locations ?? '') + ' ' + String(item.region ?? '');
    if (NON_INDIA.test(loc)) return false;
    return true;
  }

  /** "₹50,000 (Winner) · ₹25,000 (Runner up)" from the prize breakdown. */
  private formatPrizes(prizes: UnstopPrize[] | null | undefined): string | null {
    if (!prizes || prizes.length === 0) return null;

    const parts: string[] = [];
    for (const p of prizes.slice(0, 4)) {
      const rank = (p.rank ?? '').toString().trim();
      const cashRaw = p.cash;
      const cash =
        cashRaw !== null && cashRaw !== undefined && String(cashRaw).trim() !== '' && String(cashRaw) !== '0'
          ? `₹${Number(cashRaw).toLocaleString('en-IN')}`
          : '';
      const others = (p.others ?? '').toString().trim();
      const value = cash || others;
      if (!value) continue;
      parts.push(rank ? `${value} (${rank})` : value);
    }

    return parts.length > 0 ? parts.join(' · ') : null;
  }

  normalize(raw: Tagged): NormalizedOpportunity {
    const org = raw.organisation ?? {};
    const title = String(raw.title ?? '').trim();
    const applyUrl =
      raw.seo_url ??
      (raw.public_url ? `https://unstop.com/${String(raw.public_url).replace(/^\//, '')}` : '');

    const prizePool = this.formatPrizes(raw.prizes);
    const isOnline = String(raw.region ?? '').toLowerCase() === 'online';

    const bits: string[] = [];
    if (prizePool) bits.push(`Prize pool: ${prizePool}.`);
    if (raw.registerCount) bits.push(`${raw.registerCount} students already registered.`);
    bits.push(
      `${raw._category} hosted by ${org.name ?? 'an organiser'} on Unstop${isOnline ? ', held online' : ''}.`
    );

    return {
      title,
      company: org.name || 'Unstop',
      // Organiser logo, straight from Unstop — never a placeholder.
      company_logo_url: raw.logoUrl2 || org.logoUrl || null,
      location: isOnline ? 'Online' : 'India',
      mode: isOnline ? 'Remote' : 'Onsite',
      description: bits.join(' '),
      apply_url: String(applyUrl),
      source: 'unstop',
      source_id: String(raw.id ?? ''),
      category: raw._category,
      deadline: raw.end_date ?? null,
      registration_deadline: raw.end_date ?? null,
      event_date: raw.start_date ?? null,
      // opportunities.posted_at is NOT NULL and Unstop rarely sets start_date,
      // so fall back to when the listing was approved, then to now.
      posted_at: (raw.approved_date as string) ?? (raw.updated_at as string) ?? new Date().toISOString(),
      // Competitions have no salary; salary_range carries the compensation for
      // the category, which here is the prize pool.
      salary_range: prizePool,
      is_paid: prizePool ? true : null,
      skills: [],
      requirements: [],
    } as NormalizedOpportunity;
  }

  validate(o: NormalizedOpportunity): boolean {
    return Boolean(o.title && o.apply_url && o.source_id);
  }
}
