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
      deadline: (() => {
        if (!rawData.deadline) return null;
        const d = new Date(rawData.deadline);
        return isNaN(d.getTime()) ? null : d.toISOString();
      })(),
      source: providerSource,
      source_id: rawData.id || rawData.source_id || '',
      apply_url: rawData.apply_url || rawData.url || '',
      category: rawData.category || 'Job',
      company_logo_url: rawData.company_logo_url || rawData.logoUrl || rawData.logo || undefined,
      employment_type: rawData.employment_type || rawData.employmentType || rawData.type || undefined,
      requirements: Array.isArray(rawData.requirements) ? rawData.requirements : [],
      quality_score: typeof rawData.quality_score === 'number' ? rawData.quality_score : 0,
      salary_range: rawData.salary_range || undefined,
      mode: rawData.mode || rawData.work_mode || undefined,
      experience_level: rawData.experience_level || undefined,
      source_url: rawData.source_url || rawData.apply_url || rawData.url || undefined,
    };
  }
}
