import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';
import { NormalizedOpportunity } from '../types/NormalizedOpportunity';
import { OpportunityNormalizer } from '../normalization/OpportunityNormalizer';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { isInternshipClosed } from '../utils/internshalaClosedDetector';
import * as cheerio from 'cheerio';

const INDIA_CITIES = ['bangalore', 'hyderabad', 'pune', 'delhi', 'ncr', 'mumbai', 'chennai', 'remote'];

/** Pages read per category URL. Page 1-2 hold the newest listings. */
const PAGES_PER_CATEGORY = 2;
/** Unique listings handled per run, sized so storing them fits the function limit. */
const MAX_LISTINGS = 350;
/** Time allowed for list and detail fetching together. */
const DETAIL_BUDGET_MS = 110_000;

/**
 * The company cell also carries a status badge: the text came through as
 * "Acme\n        Actively hiring" and was stored as the company name.
 */
export function cleanCompanyName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s*(actively hiring|hiring actively)\s*$/i, '')
    .trim();
}

export class InternshalaProvider extends OpportunityProvider {
  readonly providerName = 'InternshalaProvider';
  async fetchListPages(): Promise<QueuePayload[]> {
    try {
      const payloads: QueuePayload[] = [];
      const urls = [
        // Software Development
        'https://internshala.com/internships/software-development-internship/',
        'https://internshala.com/internships/software-development-internship-in-bangalore/',
        'https://internshala.com/internships/software-development-internship-in-hyderabad/',
        'https://internshala.com/internships/software-development-internship-in-pune/',
        'https://internshala.com/internships/software-development-internship-in-mumbai/',
        'https://internshala.com/internships/software-development-internship-in-chennai/',
        'https://internshala.com/internships/software-development-internship-in-delhi/',
        'https://internshala.com/internships/work-from-home-software-development-internships/',
        // Web Development
        'https://internshala.com/internships/web-development-internship/',
        'https://internshala.com/internships/web-development-internship-in-bangalore/',
        'https://internshala.com/internships/web-development-internship-in-delhi/',
        'https://internshala.com/internships/work-from-home-web-development-internships/',
        // Data Science
        'https://internshala.com/internships/data-science-internship/',
        'https://internshala.com/internships/data-science-internship-in-bangalore/',
        'https://internshala.com/internships/work-from-home-data-science-internships/',
        // Python / Machine Learning
        'https://internshala.com/internships/python-django-internship/',
        'https://internshala.com/internships/machine-learning-internship/',
        // Mobile
        'https://internshala.com/internships/mobile-app-development-internship/',
      ];

      for (const baseUrl of urls) {
        for (let page = 1; page <= 10; page++) {
          const url = page === 1 ? baseUrl : `${baseUrl}page-${page}/`;
          try {
            const res = await fetchWithRetry(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
              }
            });
            const html = await res.text();
            const $ = cheerio.load(html);

            const items = $('.internship_meta');
            if (items.length === 0) break; // End of pagination

            items.each((i, el) => {
              const relativeUrl = $(el).find('.job-title-href').attr('href');
              const apply_url = relativeUrl ? `https://internshala.com${relativeUrl}` : '';
              if (apply_url) {
                const source_id = apply_url.split('/').pop() || String(Math.random());
                payloads.push({
                  source: 'internshala',
                  source_id,
                  url: apply_url
                });
              }
            });
          } catch (e: any) {
            console.warn(`Failed to scrape Internshala list url ${url}: ${e.message}`);
            break; // Stop paginating this category on error
          }
        }
      }
      return payloads;
    } catch (err) {
      console.error('Error in Internshala fetchListPages:', err);
      return [];
    }
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    try {
      const detailRes = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        }
      }, { maxRetries: 1, timeoutMs: 8000 });
      const detailHtml = await detailRes.text();

      // Internshala returns 200 with this banner instead of 404ing a closed
      // posting, so the only way to know is to read the page (DATA-02).
      if (isInternshipClosed(detailHtml)) {
        throw new Error(`Internshala posting is closed: ${url}`);
      }

      const $detail = cheerio.load(detailHtml);

      const item: any = {
        id: url.split('/').pop() || String(Math.random()),
        apply_url: url,
        category: 'Internship',
        source: 'internshala'
      };

      // 1. Title and Company
      item.title = $detail('.profile_on_detail_page').text().trim();
      item.company = cleanCompanyName($detail('.company_name').first().text());

      // 2. Location & Stipend
      item.location = $detail('.location_link').map((i, e) => $detail(e).text().trim()).get().join(', ') || 'Remote';
      item.salary_range = $detail('.stipend').text().trim();

      // 3. Logo
      let logoUrl = $detail('.internship_logo img').attr('src');
      if (!logoUrl) {
         logoUrl = $detail('.internship_logo img').attr('data-src');
      }
      item.company_logo_url = logoUrl;

      // 4. Full Description
      const fullDesc = $detail('.internship_details').first().text().replace(/\s+/g, ' ').trim();
      if (fullDesc) {
        item.description = fullDesc;
      }

      // 5. Skills
      const detailSkills: string[] = [];
      $detail('.round_tabs_container .round_tabs, .training_skills_container span').each((idx, el) => {
        detailSkills.push($detail(el).text().trim());
      });
      item.skills = detailSkills;

      // 6. Deadline
      $detail('.other_detail_item').each((idx, el) => {
        const label = $detail(el).find('.detail_title, .item_heading span').text().trim().toLowerCase();
        if (label.includes('apply by') || label.includes('deadline')) {
          const value = $detail(el).find('.detail_value, .item_body').text().trim();
          if (value) {
            item.deadline = value;
          }
        }
      });

      // 7. Posted Date (from JSON-LD)
      $detail('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonText = $detail(el).html();
          if (jsonText) {
            const parsed = JSON.parse(jsonText);
            if (parsed.datePosted) {
              item.posted_at = new Date(parsed.datePosted).toISOString();
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
      });

      return item;
    } catch (e) {
      console.error(`Failed to fetch detail page for Internshala: ${url}`, e);
      throw e;
    }
  }

  async fetch(): Promise<any[]> {
    try {
      const allData: any[] = [];
      // One run has to fetch, enrich and store inside a 300s function. The
      // old loop read 10 pages for each of 19 category URLs (2,054 listings,
      // most of them the same internship under several categories) and took
      // 257s before a single row was saved, so the scheduled job was killed
      // every night and Internshala contributed nothing after 17 June.
      const seenUrls = new Set<string>();
      const startedAt = Date.now();
      // Fetch specifically from priority cities and keywords
      const urls = [
        // Software Development
        'https://internshala.com/internships/software-development-internship/',
        'https://internshala.com/internships/software-development-internship-in-bangalore/',
        'https://internshala.com/internships/software-development-internship-in-hyderabad/',
        'https://internshala.com/internships/software-development-internship-in-pune/',
        'https://internshala.com/internships/software-development-internship-in-mumbai/',
        'https://internshala.com/internships/software-development-internship-in-chennai/',
        'https://internshala.com/internships/software-development-internship-in-delhi/',
        'https://internshala.com/internships/work-from-home-software-development-internships/',
        // Web Development
        'https://internshala.com/internships/web-development-internship/',
        'https://internshala.com/internships/web-development-internship-in-bangalore/',
        'https://internshala.com/internships/web-development-internship-in-delhi/',
        'https://internshala.com/internships/work-from-home-web-development-internships/',
        // Data Science
        'https://internshala.com/internships/data-science-internship/',
        'https://internshala.com/internships/data-science-internship-in-bangalore/',
        'https://internshala.com/internships/work-from-home-data-science-internships/',
        // Python / Machine Learning
        'https://internshala.com/internships/python-django-internship/',
        'https://internshala.com/internships/machine-learning-internship/',
        // Mobile
        'https://internshala.com/internships/mobile-app-development-internship/',
      ];

      for (const baseUrl of urls) {
        for (let page = 1; page <= PAGES_PER_CATEGORY && allData.length < MAX_LISTINGS; page++) {
          const url = page === 1 ? baseUrl : `${baseUrl}page-${page}/`;
          try {
            const res = await fetchWithRetry(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
              }
            });
            const html = await res.text();
            const $ = cheerio.load(html);

            const items = $('.internship_meta');
            if (items.length === 0) break; // Stop pagination if no items

            items.each((i, el) => {
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

              if (title && company && apply_url && !seenUrls.has(apply_url) && allData.length < MAX_LISTINGS) {
                seenUrls.add(apply_url);
                allData.push({
                  id: apply_url.split('/').pop() || String(Math.random()),
                  title,
                  company: cleanCompanyName(company),
                  location: location || 'Remote',
                  apply_url,
                  salary_range: stipend,
                  company_logo_url: logoUrl,
                  category: 'Internship',
                  description: listingDescription,
                  skills: listingSkills,
                  deadline: null,
                  posted_at: null
                });
              }
            });
          } catch (e: any) {
            console.warn(`Failed to scrape Internshala url ${url}: ${e.message}`);
            break; // Stop pagination on error
          }
        }
      }

      // Fetch detail pages in batches of 5 to get full description, skills, and deadline
      // Listings not reached before the budget keep their list-page data.
      // They are still real, open internships; they only lack the long
      // description and deadline, which the next run fills in.
      const batchSize = 12;
      for (let i = 0; i < allData.length; i += batchSize) {
        if (Date.now() - startedAt > DETAIL_BUDGET_MS) break;
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

            // Internshala returns 200 with this banner instead of 404ing a
            // closed posting, so nothing downstream would otherwise notice
            // and the listing would keep getting refreshed as live forever
            // (DATA-02). Exclude it from this run's results entirely.
            if (isInternshipClosed(detailHtml)) {
              item._closed = true;
              return;
            }

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

            // 4. Posted Date (from JSON-LD)
            $detail('script[type="application/ld+json"]').each((i, el) => {
              try {
                const jsonText = $detail(el).html();
                if (jsonText) {
                  const parsed = JSON.parse(jsonText);
                  if (parsed.datePosted) {
                    item.posted_at = new Date(parsed.datePosted).toISOString();
                  }
                }
              } catch (e) {
                // ignore parsing errors
              }
            });
          } catch (e) {
            console.warn(`Failed to fetch detail page for ${item.apply_url}`);
          }
        }));
      }
      return allData.filter((item) => !item._closed);
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
