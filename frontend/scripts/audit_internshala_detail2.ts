import * as cheerio from 'cheerio';

async function run() {
  const detailUrl = 'https://internshala.com/internship/detail/work-from-home-part-time-character-artist-rigging-animation-internship-at-krayton-gaming1781258825';
  
  const res = await fetch(detailUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'text/html'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log('=== SKILLS (from detail page) ===');
  const skills: string[] = [];
  $('.round_tabs_container .round_tabs').each((i, el) => skills.push($(el).text().trim()));
  // alt selector
  if (!skills.length) {
    $('.training_skills_container span').each((i, el) => skills.push($(el).text().trim()));
  }
  console.log(skills);
  
  console.log('\n=== STIPEND ===');
  console.log($('.stipend').first().text().trim());
  
  console.log('\n=== DURATION ===');
  // Internshala detail shows duration in other_detail_item
  $('.other_detail_item').each((i, el) => {
    const label = $(el).find('.detail_title').text().trim();
    const value = $(el).find('.detail_value, .item_body, .duration_value').text().trim();
    console.log(`  ${label}: ${value}`);
  });
  
  console.log('\n=== ABOUT THE INTERNSHIP ===');
  const desc = $('.internship_details').first().text().replace(/\s+/g, ' ').trim().slice(0, 500);
  console.log(desc);
  
  console.log('\n=== PERKS ===');
  const perks: string[] = [];
  $('.perks_heading').nextAll().find('li, .job_perk, .perk').each((i, el) => perks.push($(el).text().trim()));
  // Try another approach
  $('*:contains("Perks")').each((i, el) => {
    const next = $(el).next().text().trim();
    if (next) perks.push(next);
  });
  console.log(perks);
  
  console.log('\n=== WHO CAN APPLY / ELIGIBILITY ===');
  const whoCanApply = $('*:contains("Who can apply")').nextAll('.internship_details').first().text().trim().slice(0,300);
  console.log(whoCanApply);
  
  console.log('\n=== NUMBER OF OPENINGS ===');
  $('*').each((i, el) => {
    const text = $(el).text().trim();
    if (text.match(/number of openings|openings/i) && text.length < 80) {
      console.log('  ' + text);
    }
  });
  
  console.log('\n=== FULL OTHER DETAILS HTML ===');
  console.log($('.internship_other_details_container').html()?.slice(0, 1000));
}
run().catch(console.error);
