import * as cheerio from 'cheerio';

async function run() {
  const url = 'https://internshala.com/internships/software-development-internship/';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'text/html'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Print all class names in the first card with their text
  const first = $('.internship_meta').first();
  console.log('=== CLASS → TEXT MAPPING ===');
  first.find('[class]').each((i, el) => {
    const classes = $(el).attr('class')?.trim();
    const text = $(el).clone().children().remove().end().text().trim();
    if (classes && text) {
      console.log(`  .${classes.split(' ')[0]}  →  "${text.slice(0,80)}"`);
    }
  });
  
  // Try to extract deadline
  console.log('\n=== DEADLINE SEARCH ===');
  // Internshala shows "Apply by X" in listing cards
  first.find('*').each((i, el) => {
    const text = $(el).text().trim();
    if (text.match(/apply by|last date|closing|deadline/i) && text.length < 100) {
      console.log('  ' + JSON.stringify(text));
    }
  });
  
  console.log('\n=== OPENINGS SEARCH ===');
  first.find('*').each((i, el) => {
    const text = $(el).text().trim();
    if (text.match(/opening|position|vacancy|hired/i) && text.length < 100) {
      console.log('  ' + JSON.stringify(text));
    }
  });
  
  // Check the apply_url link
  const applyUrl = first.find('.job-title-href').attr('href');
  console.log('\nDetail page URL:', `https://internshala.com${applyUrl}`);
}
run().catch(console.error);
