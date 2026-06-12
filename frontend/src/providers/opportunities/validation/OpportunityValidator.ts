import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { FreshnessStatus, determineFreshness } from '../utils/verification';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class OpportunityValidator {
  static validate(opportunity: NormalizedOpportunity): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!opportunity.title) errors.push('Title is missing');
    if (!opportunity.company) errors.push('Company is missing');
    if (!opportunity.source) errors.push('Source is missing');
    if (!opportunity.apply_url) errors.push('Apply URL is missing');
    if (!opportunity.source_id) errors.push('Source ID is missing'); // Implied required to prevent duplicates
    if (!opportunity.category) errors.push('Category is missing');

    // URL Validation
    if (opportunity.apply_url) {
      try {
        new URL(opportunity.apply_url);
      } catch (e) {
        errors.push('Invalid apply URL');
      }
    }

    // Expiration validation
    if (opportunity.deadline) {
      const freshness = determineFreshness(new Date(), new Date(opportunity.deadline));
      if (freshness === FreshnessStatus.EXPIRED) {
        errors.push('Opportunity is expired');
      }
    }

    // Quality Scoring
    let quality_score = 0;
    if (opportunity.description && opportunity.description.length > 100) quality_score += 20;
    if (opportunity.skills && opportunity.skills.length > 0) quality_score += 15;
    if (opportunity.company_logo_url) quality_score += 15;
    if (opportunity.salary_range) quality_score += 20;
    if (opportunity.requirements && opportunity.requirements.length > 0) quality_score += 15;
    if (opportunity.deadline) quality_score += 15;
    
    opportunity.quality_score = quality_score;

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
