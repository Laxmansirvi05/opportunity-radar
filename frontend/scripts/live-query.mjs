import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function validateUrl(url) {
  if (!url) return false;
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('example.com') || url.includes('placeholder')) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (response.status === 404 || response.status === 410) return false;
    if (response.url.includes('job-unavailable') || response.url.includes('closed') || response.url.includes('not-found')) return false;

    return true;
  } catch (error) {
    return false;
  }
}

async function runLiveQuery() {
  console.log(`Supabase URL: ${supabaseUrl}`);
  const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  console.log(`Supabase Project ID: ${projectIdMatch ? projectIdMatch[1] : 'Unknown'}`);
  console.log('---');

  let hasSkillsColumn = true;
  let { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*');

  if (error && error.code === '42703') {
    hasSkillsColumn = false;
    const res = await supabase.from('opportunities').select('*');
    opportunities = res.data;
    error = res.error;
  }

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  const totalCount = opportunities.length;

  // Find duplicates
  const urlCounts = {};
  const titleCounts = {};
  opportunities.forEach(o => {
    if (o.apply_url) urlCounts[o.apply_url] = (urlCounts[o.apply_url] || 0) + 1;
    if (o.title) titleCounts[o.title.toLowerCase()] = (titleCounts[o.title.toLowerCase()] || 0) + 1;
  });

  const duplicateUrls = Object.values(urlCounts).filter(c => c > 1).reduce((acc, c) => acc + (c - 1), 0);
  const duplicateTitles = Object.values(titleCounts).filter(c => c > 1).reduce((acc, c) => acc + (c - 1), 0);

  let missingCompany = 0;
  let missingSkills = 0;
  
  if (!hasSkillsColumn) {
    missingSkills = totalCount;
  } else {
    missingSkills = opportunities.filter(o => !o.skills || o.skills.length === 0).length;
  }

  missingCompany = opportunities.filter(o => !o.company_id).length;

  // Validate broken links
  console.log(`Pinging ${totalCount} URLs to check for broken links...`);
  let brokenLinks = 0;
  for (let i = 0; i < totalCount; i++) {
    const isValid = await validateUrl(opportunities[i].apply_url);
    if (!isValid) brokenLinks++;
  }

  console.log('--- RESULTS ---');
  console.log(`1. Total opportunity count: ${totalCount}`);
  console.log(`2. Number of broken links: ${brokenLinks}`);
  console.log(`3. Number of duplicate titles: ${duplicateTitles}`);
  console.log(`4. Number of duplicate URLs: ${duplicateUrls}`);
  console.log(`5. Number of records missing company: ${missingCompany}`);
  console.log(`6. Number of records missing skills: ${missingSkills}`);
  
  if (totalCount !== 120) {
    console.log('\nWarning: Total opportunities is not 120. The cleanup has NOT actually been applied to this database.');
  }
}

runLiveQuery();
