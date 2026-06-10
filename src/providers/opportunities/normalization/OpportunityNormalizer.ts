import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export class OpportunityNormalizer {
  static normalize(
    rawData: any,
    providerSource: string
  ): NormalizedOpportunity {
    return {
      title: rawData.title || rawData.job_title || 'Unknown Title',
      company: rawData.company || rawData.company_name || 'Unknown Company',
      location: rawData.location || 'Remote',
      description: rawData.description || rawData.details || '',
      skills: Array.isArray(rawData.skills) ? rawData.skills : [],
      deadline: rawData.deadline ? new Date(rawData.deadline).toISOString() : null,
      source: providerSource,
      source_id: rawData.id || rawData.source_id || '',
      apply_url: rawData.apply_url || rawData.url || '',
      category: rawData.category || 'Job'
    };
  }
}
