import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export abstract class OpportunityProvider {
  /**
   * Fetches raw opportunities from the provider.
   */
  abstract fetch(): Promise<any[]>;

  /**
   * Normalizes the raw opportunity data into the standard NormalizedOpportunity format.
   * @param rawData The raw opportunity data from the provider.
   */
  abstract normalize(rawData: any): NormalizedOpportunity;

  /**
   * Validates if the normalized opportunity meets all requirements.
   * @param opportunity The normalized opportunity.
   */
  abstract validate(opportunity: NormalizedOpportunity): boolean;
}
