import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

export interface QueuePayload {
  source: string;
  source_id: string;
  url: string;
}

export abstract class OpportunityProvider {
  /**
   * Fast discovery pass. Scrapes ONLY list pages.
   * Returns bare URLs and high-level metadata to seed the queue.
   */
  abstract fetchListPages(): Promise<QueuePayload[]>;

  /**
   * Slow enrichment pass. Fetches the heavy detail page.
   * Used exclusively by the background worker.
   */
  abstract fetchDetailPage(url: string, rawData?: any): Promise<any>;

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
