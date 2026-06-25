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
  
  const first = $('.internship_meta').first();
  const title = first.find('.job-title-href').text().trim();
  const company = first.find('.company_name').text().trim();
  
  if (!title) {
    console.log('Card not found. Printing all class names in page...');
    const classes = new Set<string>();
    $('[class]').each((i, el) => {
      const cls = $(el).attr('class');
      if (cls) cls.split(' ').forEach(c => classes.add(c));
    });
    [...classes].filter(c => c.includes('intern') || c.includes('job') || c.includes('company')).forEach(c => console.log(c));
    
    // Print raw first 3000 chars
    console.log('\n=== HTML PREVIEW (first 5000) ===');
    console.log(html.slice(0, 5000));
    return;
  }

  console.log('TITLE:', title.slice(0,80));
  console.log('COMPANY:', company.slice(0,80));
  console.log('LOCATION:', first.find('.location_link').map((i, e) => $(e).text().trim()).get());
  console.log('STIPEND:', first.find('.stipend').text().trim());
  
  // Print all text nodes in the card
  const allText: string[] = [];
  first.find('[class]').each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 120 && !allText.includes(text)) allText.push(text);
  });
  console.log('\n=== ALL TEXT IN FIRST CARD ===');
  allText.slice(0, 40).forEach(t => console.log('  ' + JSON.stringify(t)));
}
run().catch(console.error);
