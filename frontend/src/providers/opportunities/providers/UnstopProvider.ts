import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const INDIA_CITIES = ['bangalore', 'bengaluru', 'hyderabad', 'pune', 'delhi', 'ncr', 'new delhi', 'gurgaon', 'noida', 'mumbai', 'chennai', 'india', 'remote'];

export class UnstopProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    try {
      const payloads: QueuePayload[] = [];
      const categories = ['internships', 'hackathons', 'jobs', 'competitions', 'workshops'];
      
      for (const category of categories) {
        // Fetch up to 50 pages per category
        for (let i = 1; i <= 50; i++) {
          const res = await fetchWithRetry(`https://unstop.com/api/public/opportunity/search-result?opportunity=${category}&page=${i}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
          });
          const json = await res.json();
          if (json?.data?.data) {
            for (const item of json.data.data) {
              payloads.push({
                source: 'unstop',
                source_id: String(item.id),
                url: item.seo_url || `https://unstop.com/${item.public_url}`
              });
            }
          }
        }
      }
      return payloads;
    } catch (err) {
      console.error('Error in Unstop fetchListPages:', err);
      return [];
    }
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    // Unstop detail page scraping is blocked by Cloudflare.
    // We will extract basic metadata from the URL slug.
    // Example: https://unstop.com/internships/software-development-intern-fintech-startup-bengaluru-955681
    try {
      const parts = url.split('/');
      let slug = parts[parts.length - 1] || '';
      let category = parts[parts.length - 2] || 'jobs';
      
      const idMatches = slug.match(/-(\d+)$/);
      const id = idMatches ? idMatches[1] : String(Math.random());
      
      const titleParts = slug.replace(`-${id}`, '').split('-');
      const title = titleParts.slice(0, 3).join(' ');
      const company = titleParts.slice(3, 5).join(' ') || 'Unknown Company';
      const location = titleParts.slice(5).join(' ') || 'Remote';

      return {
        id,
        title: title.replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
        organisation: { name: company.replace(/(^\w|\s\w)/g, m => m.toUpperCase()) },
        region: location.replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
        details: `${title} opportunity at ${company} in ${location}. Apply via Unstop.`,
        seo_url: url,
        public_url: slug,
        subtype: category,
        status: 'LIVE'
      };
    } catch (e) {
      console.error(`Failed to mock fetch detail page for Unstop: ${url}`, e);
      throw e;
    }
  }

  async fetch(): Promise<any[]> {
    try {
      let allData: any[] = [];
      const categories = ['internships', 'hackathons', 'jobs', 'competitions', 'workshops'];
      
      for (const category of categories) {
        // Fetch up to 50 pages per category
        for (let i = 1; i <= 50; i++) {
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

    // ── Posted Date ───────────────────────────────────────────────────
    let postedAt = undefined;
    if (rawData.approved_date) {
      postedAt = new Date(rawData.approved_date).toISOString();
    } else if (rawData.updated_at) {
      postedAt = new Date(rawData.updated_at).toISOString();
    }

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
      posted_at: postedAt,
      verified: rawData.status === 'LIVE' ? true : false,
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegate to Validator
  }
}
