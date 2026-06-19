import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export class AtlassianProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    // Lever proxy. Returning realistic seed data for Phase 2A.
    return Array.from({ length: 35 }).map((_, i) => ({
      id: `atlassian_job_${8000 + i}`,
      text: `Frontend Engineer, Jira - Level ${i % 3 + 1}`,
      categories: { location: 'Sydney, Australia', team: 'Engineering' },
      descriptionPlain: 'Join Atlassian to help teams everywhere organize their work.',
      hostedUrl: `https://jobs.lever.co/atlassian/${8000 + i}`,
    }));
  }

  normalize(rawData: any): NormalizedOpportunity {
    return {
      title: rawData.text,
      company: 'Atlassian',
      location: rawData.categories?.location || 'Remote',
      description: rawData.descriptionPlain || '',
      apply_url: rawData.hostedUrl,
      source: 'atlassian',
      source_id: rawData.id,
      category: 'Job',
      skills: ['React', 'TypeScript', 'GraphQL'],
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return !!opportunity.title && !!opportunity.source_id;
  }
}
