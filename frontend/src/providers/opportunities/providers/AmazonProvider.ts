import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { SkillExtractor } from '../utils/SkillExtractor';

export class AmazonProvider extends OpportunityProvider {
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }

  async fetch(): Promise<any[]> {
    const records = [];
    const LIMIT = 100;
    const MAX_RECORDS = 500;

    for (let offset = 0; offset < MAX_RECORDS; offset += LIMIT) {
      try {
        const url = `https://www.amazon.jobs/en/search.json?offset=${offset}&result_limit=${LIMIT}&country=IND`;
        const response = await globalThis.fetch(url);
        
        if (!response.ok) {
          console.error(`Amazon API failed with status ${response.status}`);
          break;
        }

        const data = await response.json();
        const jobs = data.jobs || [];
        
        if (jobs.length === 0) break;
        
        records.push(...jobs);
      } catch (e) {
        console.error("Error fetching from Amazon:", e);
        break;
      }
    }

    return records;
  }

  normalize(rawData: any): NormalizedOpportunity {
    const rawDesc = rawData.description || '';
    const descShort = rawData.description_short || '';
    const basicQuals = rawData.basic_qualifications || '';
    const prefQuals = rawData.preferred_qualifications || '';

    // Priority: full description -> short description -> fallback
    let description = rawDesc || descShort || 'Opportunity at Amazon';
    
    // Append qualifications to the description if not already present
    if (basicQuals && !description.includes(basicQuals.substring(0, 50))) {
      description += `\n\nBasic Qualifications:\n${basicQuals}`;
    }
    if (prefQuals && !description.includes(prefQuals.substring(0, 50))) {
      description += `\n\nPreferred Qualifications:\n${prefQuals}`;
    }

    // Extract skills from all relevant text
    const combinedText = `${description} ${basicQuals} ${prefQuals}`;
    const skills = SkillExtractor.extract(combinedText);

    // Extract bullet points for requirements/responsibilities
    const requirements: string[] = [];
    const bulletRegex = /(?:^|<br\/>)\s*[-*•]\s*(.+?)(?=<br\/>|$)/gi;
    let match;
    
    // We check basic and preferred quals specifically for bullet points
    const qualsText = `${basicQuals}<br/>${prefQuals}`;
    while ((match = bulletRegex.exec(qualsText)) !== null) {
      if (match[1].trim()) requirements.push(match[1].trim());
    }
    
    // Check main description for bullet points too
    while ((match = bulletRegex.exec(rawDesc)) !== null) {
      if (match[1].trim() && !requirements.includes(match[1].trim())) {
         requirements.push(match[1].trim());
      }
    }

    let postedAt = undefined;
    if (rawData.posted_date) {
      try {
        postedAt = new Date(rawData.posted_date).toISOString();
      } catch (e) {
        // ignore invalid dates
      }
    }

    return {
      title: rawData.title,
      company: 'Amazon', 
      location: rawData.normalized_location || rawData.location,
      description: description,
      apply_url: `https://www.amazon.jobs${rawData.job_path}`,
      source: 'amazon',
      source_id: rawData.id_icims || rawData.id,
      category: 'Job',
      skills: skills,
      requirements: requirements.slice(0, 15), // cap at 15 to avoid massive arrays
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
      posted_at: postedAt,
    };
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return !!opportunity.title && !!opportunity.source_id;
  }
}
