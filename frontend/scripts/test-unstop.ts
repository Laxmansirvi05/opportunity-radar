import { fetchWithRetry } from '../src/providers/opportunities/utils/fetchWithRetry';
import * as cheerio from 'cheerio';

async function test() {
  const url = "https://unstop.com/internships/software-development-intern-fintech-startup-bengaluru-955681";
  try {
     const res = await fetchWithRetry(url, {
       headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
       }
     });
     const html = await res.text();
     const $ = cheerio.load(html);
     console.log("Title:", $('meta[property="og:title"]').attr('content'));
     console.log("Desc:", $('meta[property="og:description"]').attr('content'));
     console.log("Image:", $('meta[property="og:image"]').attr('content'));
  } catch(e) {
     console.log(e);
  }
}
test();
