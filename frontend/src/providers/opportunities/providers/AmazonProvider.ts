import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export class AmazonProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    // Amazon API proxy. Returning realistic seed data for Phase 2A.
    return Array.from({ length: 35 }).map((_, i) => ({
      id: `amazon_job_${1000 + i}`,
      title: `Software Development Engineer - Level ${i % 3 === 0 ? 'II' : 'I'}`,
      company_name: 'Amazon',
      location: i % 2 === 0 ? 'Seattle, WA' : 'Remote',
      description_short: 'Join AWS to build highly scalable distributed systems.',
      job_path: `/jobs/${1000 + i}/sde`,
      category: 'Job',
    }));
  }

  normalize(rawData: any): NormalizedOpportunity {
    return {
      title: rawData.title,
      company: rawData.company_name,
      location: rawData.location,
      description: rawData.description_short,
      apply_url: `https://www.amazon.jobs/en${rawData.job_path}`,
      source: 'amazon',
      source_id: rawData.id,
      category: rawData.category,
      skills: ['AWS', 'Java', 'Distributed Systems'],
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return !!opportunity.title && !!opportunity.source_id;
  }
}
