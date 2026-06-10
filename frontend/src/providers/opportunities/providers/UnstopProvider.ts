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
    let category = 'Job';
    if (rawData.subtype === 'internships' || rawData.type === 'internships') {
      category = 'Internship';
    } else if (rawData.type === 'hackathons') {
      category = 'Hackathon';
    }

    return {
      title: rawData.title || 'Unknown Title',
      company: rawData.organisation?.name || 'Unknown Company',
      location: rawData.region === 'online' ? 'Remote' : rawData.region || 'Remote',
      description: rawData.details || rawData.title,
      skills: [], // Requires HTML parsing from details which we skip for simplicity
      deadline: rawData.updated_at || null, // Best effort for deadline if not provided
      source: 'unstop',
      source_id: String(rawData.id),
      apply_url: rawData.seo_url || `https://unstop.com/${rawData.public_url}`,
      category: category,
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegate to OpportunityValidator
  }
}
