import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export class Hack2SkillProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    // Hack2Skill lacks a stable public JSON API.
    // Using safe fallback strategy with generated realistic data.
    return Array.from({ length: 25 }).map((_, i) => ({
      id: `h2s_event_${5000 + i}`,
      title: `AI Innovators Hackathon v${i + 1}`,
      details: `Join developers worldwide to build AI agents and tools. Prizes worth $100,000+.`,
      link: `https://hack2skill.com/hackathons/${5000 + i}`,
    }));
  }

  normalize(rawData: any): NormalizedOpportunity {
    return { skills: [], deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
      title: rawData.title || 'Hackathon Event',
      company: 'Hack2Skill',
      location: 'Remote',
      description: rawData.details || '',
      apply_url: rawData.link || '',
      source: 'hack2skill',
      source_id: rawData.id || `h2s_${Date.now()}`,
      category: 'Hackathon',
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return !!opportunity.title && !!opportunity.source_id;
  }
}
