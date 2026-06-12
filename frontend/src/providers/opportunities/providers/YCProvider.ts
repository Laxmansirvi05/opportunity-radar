import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';

export class YCProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    try {
      // 1. Fetch latest job story IDs from Hacker News (official API for YC jobs)
      const res = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
      const jobIds = await res.json();
      
      // Limit to 25 items for initial testing
      const limitedIds = jobIds.slice(0, 25);
      
      // 2. Fetch details for each job
      const jobs = await Promise.all(
        limitedIds.map(async (id: number) => {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return await itemRes.json();
        })
      );
      
      // Filter out any nulls
      return jobs.filter(job => job !== null);
    } catch (err) {
      console.error('Error fetching YC jobs from HN API:', err);
      return [];
    }
  }

  normalize(rawData: any): NormalizedOpportunity {
    // Extract company name from title (e.g. "Emerge Career (YC S22) Is Hiring a Founding Growth Marketer")
    // Simple heuristic: Take text before "Is Hiring" or "is hiring" or "hiring"
    let companyName = 'Unknown YC Startup';
    if (rawData.title) {
      const match = rawData.title.match(/(.*?)(?:\s+is hiring|\s+hiring|\s+\()/i);
      if (match && match[1]) {
        companyName = match[1].trim();
      }
    }

    return {
      title: rawData.title || 'Unknown Job',
      company: companyName,
      location: 'Remote/Various', // HN API doesn't guarantee location in metadata
      description: rawData.text || rawData.title || '',
      skills: [], // HN doesn't provide structured skills
      deadline: null,
      source: 'ycombinator',
      source_id: String(rawData.id),
      apply_url: rawData.url || `https://news.ycombinator.com/item?id=${rawData.id}`,
      category: 'Job',
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegation to OpportunityValidator
  }
}
