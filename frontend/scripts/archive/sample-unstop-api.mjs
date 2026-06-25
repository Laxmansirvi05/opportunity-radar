// Prints all top-level keys from 3 consecutive records to confirm field consistency
const res = await fetch(
  'https://unstop.com/api/public/opportunity/search-result?opportunity=internships&page=1',
  {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  }
);
const json = await res.json();
const records = json?.data?.data ?? [];

for (let i = 0; i < Math.min(3, records.length); i++) {
  const r = records[i];
  console.log(`\n=== Record ${i+1}: ${r.title} ===`);
  console.log('Top-level keys:', Object.keys(r).sort().join(', '));
  console.log('  required_skills:', r.required_skills?.map(s => s.skill_name).join(', ') || 'none');
  console.log('  jobDetail.type:', r.jobDetail?.type);
  console.log('  jobDetail.paid_unpaid:', r.jobDetail?.paid_unpaid);
  console.log('  jobDetail.min_salary:', r.jobDetail?.min_salary);
  console.log('  jobDetail.max_salary:', r.jobDetail?.max_salary);
  console.log('  jobDetail.currency:', r.jobDetail?.currency);
  console.log('  jobDetail.timing:', r.jobDetail?.timing);
  console.log('  end_date:', r.end_date);
  console.log('  regnRequirements.end_regn_dt:', r.regnRequirements?.end_regn_dt);
  console.log('  region:', r.region);
  console.log('  status:', r.status);
  console.log('  isPaid:', r.isPaid);
  console.log('  seo_url:', r.seo_url);
  console.log('  logoUrl2:', r.logoUrl2);
  console.log('  address_with_country_logo:', JSON.stringify(r.address_with_country_logo));
  console.log('  filters (experience):', r.filters?.map(f => `${f.type}:${f.name}`).join(', ') || 'none');
  console.log('  workfunction:', r.workfunction?.map(w => w.name).join(', ') || 'none');
}
