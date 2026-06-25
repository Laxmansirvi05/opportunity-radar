import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
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

async function runAudit() {
  console.log("Starting Phase 5 Data Quality Audit...\n");

  let hasSkillsColumn = true;
  // First attempt to fetch with skills
  let { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*, companies(name)');

  if (error && error.code === '42703') {
    hasSkillsColumn = false;
    const res = await supabase
      .from('opportunities')
      .select('*, companies(name)');
    opportunities = res.data;
    error = res.error;
  }

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  // 1. Total opportunities
  const totalOpps = opportunities.length;

  // 2. Distinct companies
  const distinctCompanies = new Set(opportunities.map(o => o.company_id).filter(Boolean));
  const distinctCompanyCount = distinctCompanies.size;

  // 3. Missing company names
  const missingCompany = opportunities.filter(o => !o.company_id || (o.companies && !o.companies.name)).length;

  // 4. Missing descriptions
  const missingDescription = opportunities.filter(o => !o.description || o.description.trim() === '').length;

  // 5. Missing skills
  let missingSkills = 0;
  let lessThanTwoSkills = 0;
  let totalSkillsCount = 0;

  if (hasSkillsColumn) {
    for (const o of opportunities) {
      if (!o.skills || !Array.isArray(o.skills) || o.skills.length === 0) {
        missingSkills++;
        lessThanTwoSkills++;
      } else {
        totalSkillsCount += o.skills.length;
        if (o.skills.length < 2) lessThanTwoSkills++;
      }
    }
  } else {
    missingSkills = totalOpps;
    lessThanTwoSkills = totalOpps;
  }

  const averageSkills = totalOpps > 0 ? (totalSkillsCount / totalOpps) : 0;

  // 6. Missing apply links
  const missingApplyUrl = opportunities.filter(o => !o.apply_url || o.apply_url.trim() === '').length;

  // 9. Less than 50 chars description
  const shortDescription = opportunities.filter(o => o.description && o.description.trim().length < 50).length;

  // 10. Duplicate URLs
  const urlCounts = {};
  opportunities.forEach(o => {
    if (o.apply_url) {
      urlCounts[o.apply_url] = (urlCounts[o.apply_url] || 0) + 1;
    }
  });
  const duplicateUrls = Object.values(urlCounts).filter(count => count > 1).length;

  // 11. Duplicate titles
  const titleCounts = {};
  opportunities.forEach(o => {
    if (o.title) {
      titleCounts[o.title.toLowerCase()] = (titleCounts[o.title.toLowerCase()] || 0) + 1;
    }
  });
  const duplicateTitles = Object.values(titleCounts).filter(count => count > 1).length;

  // 7. Invalid apply links (validate all)
  console.log("Validating URLs...");
  let invalidApplyLinks = 0;
  for (let i = 0; i < opportunities.length; i++) {
    const isValid = await validateUrl(opportunities[i].apply_url);
    if (!isValid) invalidApplyLinks++;
    
    if (i % 25 === 0 && i > 0) {
      console.log(`Validated ${i}/${totalOpps} URLs...`);
    }
  }

  // Top 20 Companies
  const companyCounts = {};
  opportunities.forEach(o => {
    const name = o.companies?.name || o.company_id || 'Unknown';
    companyCounts[name] = (companyCounts[name] || 0) + 1;
  });
  
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Status checks
  let status = "PASS";
  let failReasons = [];

  if (averageSkills < 2) {
    status = "FAIL";
    failReasons.push(`Average skills per opportunity (${averageSkills.toFixed(1)}) is less than 2.`);
  }
  
  if (distinctCompanyCount < 20) {
    status = "FAIL";
    failReasons.push(`Company count (${distinctCompanyCount}) is less than 20.`);
  }

  if (invalidApplyLinks > 0 || missingApplyUrl > 0) {
    status = "FAIL";
    failReasons.push(`There are ${invalidApplyLinks + missingApplyUrl} broken/missing links.`);
  }

  const report = `
# PHASE 5 DATA QUALITY VERIFICATION REPORT

Total opportunities: ${totalOpps}

Distinct companies: ${distinctCompanyCount}

Records missing company: ${missingCompany}

Records missing skills: ${missingSkills}

Records missing description: ${missingDescription}

Records missing apply URL: ${missingApplyUrl}

Average skills per opportunity: ${averageSkills.toFixed(1)}

Opportunities with < 2 skills: ${lessThanTwoSkills}

Opportunities with < 50 chars description: ${shortDescription}

Duplicate URLs: ${duplicateUrls}

Duplicate titles: ${duplicateTitles}

Broken or invalid links: ${invalidApplyLinks}

## Top 20 companies by opportunity count
${topCompanies.map((c, i) => `${i + 1}. ${c[0]}: ${c[1]} opportunities`).join('\n')}

---
**Deployment recommendation:** ${status}

${status === "FAIL" ? `**Failure Reasons:**\n${failReasons.map(r => '- ' + r).join('\n')}` : ''}
  `;

  const reportPath = path.join(process.cwd(), 'phase_5_report.md');
  fs.writeFileSync(reportPath, report.trim());
  
  console.log("\n=========================");
  console.log(report.trim());
  console.log("=========================\n");
}

runAudit();
