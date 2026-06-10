import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';

export class WellfoundProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    // Due to "No scraping / No external APIs" constraint and Cloudflare blocks,
    // Wellfound uses a static seed.
    return [
      {
        id: 'wf_201',
        title: 'Full Stack Software Engineer',
        company: 'Innovate AI',
        location: 'Remote',
        description: 'Looking for a full stack engineer to build AI-powered tools. Node.js and React experience required.',
        skills: ['Node.js', 'React', 'PostgreSQL'],
        deadline: null,
        url: 'https://wellfound.com/jobs/201',
        category: 'Job',
      },
      {
        id: 'wf_202',
        title: 'Product Designer',
        company: 'DesignLabs Inc',
        location: 'San Francisco, CA',
        description: 'Design the next generation of creative tools. Figma expertise required.',
        skills: ['Figma', 'UI/UX'],
        deadline: null,
        url: 'https://wellfound.com/jobs/202',
        category: 'Job',
      }
    ];
  }

  normalize(rawData: any): NormalizedOpportunity {
    return OpportunityNormalizer.normalize(rawData, 'wellfound');
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true;
  }
}
