import * as cheerio from 'cheerio';

async function run() {
  // Fetch a real detail page to see full field availability
  const detailUrl = 'https://internshala.com/internship/detail/work-from-home-part-time-character-artist-rigging-animation-internship-at-krayton-gaming1781258825';
  
  const res = await fetch(detailUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'text/html'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log('=== DETAIL PAGE CLASS → TEXT ===');
  
  // Try multiple known selector patterns for Internshala detail pages
  const selectors = [
    '.internship_details', '.internship-detail-cover', '.detail-section', 
    '.about_company_text', '.about_company',
    '.text_desc', '.round_tabs_container',
    '.section_heading', '.other-details',
    '#about-internship', '#about-company'
  ];
  
  selectors.forEach(sel => {
    const el = $(sel);
    if (el.length) {
      const text = el.text().trim().slice(0, 200);
      console.log(`${sel}: ${JSON.stringify(text)}`);
    }
  });
  
  // Print all classes that exist
  const classes = new Set<string>();
  $('[class]').each((i, el) => {
    const cls = $(el).attr('class');
    if (cls) cls.split(' ').filter(Boolean).forEach(c => classes.add(c.trim()));
  });
  
  console.log('\n=== ALL CLASSES FOUND ON DETAIL PAGE ===');
  const relevantClasses = [...classes].filter(c => 
    c.includes('detail') || c.includes('about') || c.includes('section') || 
    c.includes('skill') || c.includes('stipend') || c.includes('duration') || 
    c.includes('deadline') || c.includes('perk') || c.includes('eligi') || 
    c.includes('open') || c.includes('desc') || c.includes('other')
  );
  relevantClasses.forEach(c => console.log('  .' + c));
  
  // Preview page text
  console.log('\n=== PAGE TEXT PREVIEW (2000 chars) ===');
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  console.log(bodyText.slice(0, 2000));
}
run().catch(console.error);
