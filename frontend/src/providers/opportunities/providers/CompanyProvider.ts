import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';

export class CompanyProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    // Mock realistic ATS data from Greenhouse/Lever logic
    return Array.from({ length: 10 }).map((_, i) => ({
      id: `gh_${1000 + i}`,
      job_title: `Software Engineer L${(i % 3) + 3} - ${i % 2 === 0 ? 'Backend' : 'Frontend'}`,
      company_name: `TechCorp ${i + 1}`,
      location: i % 2 === 0 ? 'San Francisco, CA' : 'New York, NY',
      details: `We are looking for an experienced engineer to join TechCorp ${i + 1}.`,
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * (10 + i)).toISOString(), // 10-20 days from now
      url: `https://techcorp${i + 1}.greenhouse.io/jobs/gh_${1000 + i}`,
      category: 'Job',
    }));
  }

  normalize(rawData: any): NormalizedOpportunity {
    return OpportunityNormalizer.normalize(rawData, 'greenhouse');
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Used OpportunityValidator in the pipeline instead
  }
}
