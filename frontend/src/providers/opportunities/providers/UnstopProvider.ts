import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const INDIA_CITIES = ['bangalore', 'bengaluru', 'hyderabad', 'pune', 'delhi', 'ncr', 'new delhi', 'gurgaon', 'noida', 'mumbai', 'chennai', 'india', 'remote'];

export class UnstopProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    try {
      let allData: any[] = [];
      const categories = ['internships', 'hackathons', 'jobs', 'competitions'];
      
      for (const category of categories) {
        // Fetch up to 3 pages per category
        for (let i = 1; i <= 3; i++) {
          const res = await fetchWithRetry(`https://unstop.com/api/public/opportunity/search-result?opportunity=${category}&page=${i}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
          });
          const json = await res.json();
          if (json?.data?.data) {
            allData = allData.concat(json.data.data);
          }
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
    } else if (rawData.type === 'competitions') {
      category = 'Competition';
    } else if (rawData.type === 'workshops') {
      category = 'Workshop';
    }

    // ── Skills ────────────────────────────────────────────────────────
    const skills: string[] = Array.isArray(rawData.required_skills)
      ? rawData.required_skills.map((s: any) => s.skill_name).filter(Boolean)
      : [];

    // ── Requirements ──────────────────────────────────────────────────
    const requirements: string[] = [];
    if (rawData.eligibility) requirements.push(rawData.eligibility);

    // ── Deadline ──────────────────────────────────────────────────────
    const deadline = rawData.end_date || rawData.regnRequirements?.end_regn_dt || null;

    // ── Mode ──────────────────────────────────────────────────────────
    const jobType = rawData.jobDetail?.type;
    let mode: string | undefined;
    if (jobType === 'wfh') mode = 'Remote';
    else if (jobType === 'hybrid') mode = 'Hybrid';
    else if (jobType) mode = 'Onsite';

    // ── Location & India First Filtering ──────────────────────────────
    let location = rawData.region === 'online' ? 'Remote' : rawData.region || 'Remote';
    const locLower = location.toLowerCase();
    
    // If not remote and not matching priority Indian cities, we might still ingest it, 
    // but the engine prefers priority cities.
    const isPriorityCity = INDIA_CITIES.some(city => locLower.includes(city));
    if (!isPriorityCity && location !== 'Remote') {
      // In a strict India-first mode, we could reject. We'll append India to clarify.
      if (!locLower.includes('india')) {
        location = `${location}, India`; // Assuming most Unstop are India-based
      }
    }

    // ── Salary range ──────────────────────────────────────────────────
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

    // ── Logos ─────────────────────────────────────────────────────────
    const company_logo_url = rawData.organisation?.logoUrl2 || rawData.organisation?.logoUrl || undefined;

    return {
      title: rawData.title || 'Unknown Title',
      company: rawData.organisation?.name || 'Unknown Company',
      location,
      description: rawData.details || rawData.title,
      skills,
      requirements,
      deadline,
      source: 'unstop',
      source_id: String(rawData.id),
      apply_url: rawData.seo_url || `https://unstop.com/${rawData.public_url}`,
      source_url: rawData.seo_url || undefined,
      category,
      mode,
      salary_range,
      company_logo_url,
      verified: rawData.status === 'LIVE' ? true : false,
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegate to Validator
  }
}
