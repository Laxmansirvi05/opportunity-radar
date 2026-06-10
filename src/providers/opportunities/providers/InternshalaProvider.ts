import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';

export class InternshalaProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    // Due to "No scraping / No external APIs" constraint, Internshala uses a static seed.
    // They do not provide a public JSON API or RSS feed.
    return [
      {
        id: 'is_101',
        title: 'Frontend Development Internship',
        company: 'TechFlow Solutions',
        location: 'Bangalore, India',
        description: 'Join our frontend team to build modern React applications. Experience with TypeScript preferred.',
        skills: ['React', 'TypeScript', 'CSS'],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        url: 'https://internshala.com/internship/detail/101',
        category: 'Internship',
      },
      {
        id: 'is_102',
        title: 'Data Science Intern',
        company: 'Analytics Hive',
        location: 'Remote',
        description: 'Work with our data team to clean datasets and train ML models using Python.',
        skills: ['Python', 'Pandas', 'Machine Learning'],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString(),
        url: 'https://internshala.com/internship/detail/102',
        category: 'Internship',
      }
    ];
  }

  normalize(rawData: any): NormalizedOpportunity {
    return OpportunityNormalizer.normalize(rawData, 'internshala');
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true; // Delegation to OpportunityValidator
  }
}
