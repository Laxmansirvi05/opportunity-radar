import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';

export class UnstopProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    try {
      let allData: any[] = [];
      // Fetch 10 pages to get >100 records (usually 15-20 per page)
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`https://unstop.com/api/public/opportunity/search-result?opportunity=internships&page=${i}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
          }
        });
        const json = await res.json();
        if (json?.data?.data) {
          allData = allData.concat(json.data.data);
        }
      }
      return allData;
    } catch (err) {
      console.error('Error fetching from Unstop:', err);
      return [];
    }
  }

  normalize(rawData: any): NormalizedOpportunity {
    // ── Category ─────────────────────────────────────────────────────
    let category = 'Job';
    if (rawData.subtype === 'internships' || rawData.type === 'internships') {
      category = 'Internship';
    } else if (rawData.type === 'hackathons') {
      category = 'Hackathon';
    }

    // ── Skills (was hardcoded []) ─────────────────────────────────────
    const skills: string[] = Array.isArray(rawData.required_skills)
      ? rawData.required_skills.map((s: any) => s.skill_name).filter(Boolean)
      : [];

    // ── Deadline (was mapped to updated_at — wrong) ──────────────────
    const deadline =
      rawData.end_date ||
      rawData.regnRequirements?.end_regn_dt ||
      null;

    // ── Mode (was always null) ────────────────────────────────────────
    const jobType = rawData.jobDetail?.type;
    let mode: string | undefined;
    if (jobType === 'wfh') mode = 'Remote';
    else if (jobType === 'hybrid') mode = 'Hybrid';
    else if (jobType) mode = 'Onsite';

    // ── Salary range (was always null) ───────────────────────────────
    let salary_range: string | undefined;
    const jd = rawData.jobDetail;
    if (jd && jd.paid_unpaid === 'paid' && !jd.not_disclosed) {
      const symbol = jd.currency === 'fa-rupee' ? '₹' : '$';
      const period = jd.pay_in === 'monthly' ? '/month' : `/${jd.pay_in ?? 'period'}`;
      if (jd.min_salary != null && jd.max_salary != null) {
        salary_range = `${symbol}${jd.min_salary.toLocaleString('en-IN')} – ${symbol}${jd.max_salary.toLocaleString('en-IN')}${period}`;
      } else if (jd.min_salary != null) {
        salary_range = `${symbol}${jd.min_salary.toLocaleString('en-IN')}+${period}`;
      }
    }

    // ── is_paid (was always null) ─────────────────────────────────────
    const is_paid: boolean | undefined =
      jd?.paid_unpaid != null ? jd.paid_unpaid === 'paid' : undefined;

    // ── Experience level from filters (was always null) ───────────────
    const eligibleFilters: string[] = Array.isArray(rawData.filters)
      ? rawData.filters
          .filter((f: any) => f.type === 'eligible')
          .map((f: any) => f.name)
          .filter(Boolean)
      : [];
    const experience_level = eligibleFilters.length > 0 ? eligibleFilters.join(', ') : undefined;

    return {
      title: rawData.title || 'Unknown Title',
      company: rawData.organisation?.name || 'Unknown Company',
      location: rawData.region === 'online' ? 'Remote' : rawData.region || 'Remote',
      description: rawData.details || rawData.title,
      skills,
      deadline,
      source: 'unstop',
      source_id: String(rawData.id),
      apply_url: rawData.seo_url || `https://unstop.com/${rawData.public_url}`,
      source_url: rawData.seo_url || undefined,
      category,
      mode,
      is_paid,
      salary_range,
      verified: rawData.status === 'LIVE' ? true : false,
      experience_level,
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegate to OpportunityValidator
  }
}
