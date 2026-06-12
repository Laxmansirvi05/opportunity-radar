import { OpportunityProvider } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import * as cheerio from 'cheerio';

const INDIA_CITIES = ['bangalore', 'hyderabad', 'pune', 'delhi', 'ncr', 'mumbai', 'chennai', 'remote'];

export class InternshalaProvider extends OpportunityProvider {
  async fetch(): Promise<any[]> {
    try {
      let allData: any[] = [];
      // Fetch specifically from priority cities and keywords
      const urls = [
        'https://internshala.com/internships/software-development-internship/',
        'https://internshala.com/internships/software-development-internship-in-bangalore/',
        'https://internshala.com/internships/software-development-internship-in-hyderabad/',
      ];

      for (const url of urls) {
        try {
          const res = await fetchWithRetry(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
          });
          const html = await res.text();
          const $ = cheerio.load(html);

          $('.internship_meta').each((i, el) => {
            const title = $(el).find('.job-title-href').text().trim();
            const company = $(el).find('.company_name').text().trim();
            const relativeUrl = $(el).find('.job-title-href').attr('href');
            const apply_url = relativeUrl ? `https://internshala.com${relativeUrl}` : '';
            
            // Extract location, duration, stipend
            const location = $(el).find('.location_link').map((i, e) => $(e).text().trim()).get().join(', ');
            const stipend = $(el).find('.stipend').text().trim();
            
            // Extract listing description and skills
            const listingDescription = $(el).find('.text').text().trim();
            const listingSkills = $(el).find('.job_skill').map((i, e) => $(e).text().trim()).get();

            // Internshala logos are often in a div with class internship_logo
            let logoUrl = $(el).find('.internship_logo img').attr('src');
            // Sometimes they use data-src for lazy loading or different classes
            if (!logoUrl) {
               logoUrl = $(el).find('.internship_logo img').attr('data-src');
            }

            if (title && company && apply_url) {
              allData.push({
                id: apply_url.split('/').pop() || String(Math.random()),
                title,
                company,
                location: location || 'Remote',
                apply_url,
                salary_range: stipend,
                company_logo_url: logoUrl,
                category: 'Internship',
                description: listingDescription,
                skills: listingSkills,
                deadline: null
              });
            }
          });
        } catch (e: any) {
          console.warn(`Failed to scrape Internshala url ${url}: ${e.message}`);
        }
      }

      // Fetch detail pages in batches of 5 to get full description, skills, and deadline
      const batchSize = 5;
      for (let i = 0; i < allData.length; i += batchSize) {
        const batch = allData.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
          try {
            const detailRes = await fetchWithRetry(item.apply_url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html'
              }
            }, { maxRetries: 1, timeoutMs: 8000 });
            const detailHtml = await detailRes.text();
            const $detail = cheerio.load(detailHtml);
            
            // 1. Full Description
            const fullDesc = $detail('.internship_details').first().text().replace(/\s+/g, ' ').trim();
            if (fullDesc) {
              item.description = fullDesc;
            }

            // 2. Skills
            const detailSkills: string[] = [];
            $detail('.round_tabs_container .round_tabs, .training_skills_container span').each((idx, el) => {
              detailSkills.push($detail(el).text().trim());
            });
            if (detailSkills.length > 0) {
              item.skills = Array.from(new Set([...(item.skills || []), ...detailSkills]));
            }

            // 3. Deadline (if present in other_detail_item)
            $detail('.other_detail_item').each((idx, el) => {
              const label = $detail(el).find('.detail_title, .item_heading span').text().trim().toLowerCase();
              if (label.includes('apply by') || label.includes('deadline')) {
                const value = $detail(el).find('.detail_value, .item_body').text().trim();
                if (value) {
                  // e.g. "20 Jun 2026" or "Rolling"
                  item.deadline = value;
                }
              }
            });
          } catch (e) {
            console.warn(`Failed to fetch detail page for ${item.apply_url}`);
          }
        }));
      }
      return allData;
    } catch (err) {
      console.error('Error in InternshalaProvider:', err);
      return [];
    }
  }

  normalize(rawData: any): NormalizedOpportunity {
    return OpportunityNormalizer.normalize(rawData, 'internshala');
  }

  validate(opportunity: NormalizedOpportunity): boolean {
    return true;
  }
}
