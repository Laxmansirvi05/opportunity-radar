import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export class GitHubProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    // Greenhouse proxy. Returning realistic seed data for Phase 2A.
    return Array.from({ length: 35 }).map((_, i) => ({
      id: 5000000 + i,
      title: `Staff Software Engineer, Copilot ${i}`,
      location: { name: 'Remote - US' },
      content: 'Help build the future of AI assisted development at GitHub.',
      absolute_url: `https://github.com/careers/jobs/${5000000 + i}`,
    }));
  }

  normalize(rawData: any): NormalizedOpportunity {
    return {
      title: rawData.title,
      company: 'GitHub',
      location: rawData.location?.name || 'Remote',
      description: rawData.content || '',
      apply_url: rawData.absolute_url,
      source: 'github',
      source_id: `gh_${rawData.id}`,
      category: 'Job',
      skills: ['Ruby on Rails', 'React', 'Go'],
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return !!opportunity.title && !!opportunity.source_id;
  }
}
