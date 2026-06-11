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

async function runStats() {
  // Read data audit report to get removed count
  let removedLinks = 0;
  let totalInitial = 0;
  let validLinks = 0;
  try {
    const reportContent = fs.readFileSync(path.join(process.cwd(), 'data_audit_report.md'), 'utf-8');
    const totalMatch = reportContent.match(/\*\*Total Opportunities \(Initial\):\*\* (\d+)/);
    const validMatch = reportContent.match(/\*\*Valid Apply Links:\*\* (\d+)/);
    const invalidMatch = reportContent.match(/\*\*Invalid Apply Links:\*\* (\d+)/);

    if (totalMatch) totalInitial = parseInt(totalMatch[1]);
    if (validMatch) validLinks = parseInt(validMatch[1]);
    if (invalidMatch) removedLinks = parseInt(invalidMatch[1]);
  } catch (e) {
    console.log("Could not read data_audit_report.md");
  }

  // Get current DB state
  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, company_id, description, category, title');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  // Companies represented
  const companyIds = new Set();
  opportunities.forEach(opp => {
    if (opp.company_id) companyIds.add(opp.company_id);
  });

  // Calculate average skills
  // Since the DB column might not exist yet, we'll re-run our extraction logic to get the average
  const ROLE_SKILLS = {
    'Design': ['Figma', 'Photoshop', 'Illustrator', 'Canva', 'Sketch', 'Adobe XD', 'InDesign', 'UI/UX', 'Wireframing', 'Prototyping'],
    'Frontend': ['React', 'TypeScript', 'Next.js', 'Vue', 'Angular', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Redux', 'Zustand', 'JavaScript', 'Webpack'],
    'Backend': ['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Docker', 'Kubernetes', 'AWS', 'Java', 'Spring Boot', 'Python', 'Django', 'Go', 'Rust', 'C#', '.NET'],
    'Data Science': ['Python', 'Pandas', 'Machine Learning', 'SQL', 'TensorFlow', 'PyTorch', 'R', 'Data Analysis', 'Tableau', 'Power BI', 'NumPy', 'Scikit-learn', 'NLP', 'Computer Vision'],
    'Product': ['Product Management', 'Agile', 'Scrum', 'Jira', 'Roadmapping', 'User Research', 'A/B Testing', 'Stakeholder Management', 'Data Analysis'],
    'Mobile': ['Swift', 'Kotlin', 'React Native', 'Flutter', 'iOS', 'Android', 'Objective-C', 'Mobile UI'],
    'DevOps': ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Terraform', 'Linux', 'Bash', 'Git', 'Ansible']
  };

  function extractRoleSkills(text, category, title) {
    if (!text) return [];
    const lowerText = (text + ' ' + title + ' ' + category).toLowerCase();
    const extracted = new Set();

    let matchedRoles = [];
    if (lowerText.includes('design') || lowerText.includes('ui/ux')) matchedRoles.push('Design');
    if (lowerText.includes('frontend') || lowerText.includes('front-end') || lowerText.includes('react') || lowerText.includes('web dev')) matchedRoles.push('Frontend');
    if (lowerText.includes('backend') || lowerText.includes('back-end') || lowerText.includes('server')) matchedRoles.push('Backend');
    if (lowerText.includes('data') || lowerText.includes('machine learning') || lowerText.includes('ai')) matchedRoles.push('Data Science');
    if (lowerText.includes('product') || lowerText.includes('pm')) matchedRoles.push('Product');
    if (lowerText.includes('mobile') || lowerText.includes('ios') || lowerText.includes('android')) matchedRoles.push('Mobile');
    if (lowerText.includes('devops') || lowerText.includes('site reliability') || lowerText.includes('sre')) matchedRoles.push('DevOps');

    const rolesToCheck = matchedRoles.length > 0 ? matchedRoles : Object.keys(ROLE_SKILLS);

    for (const role of rolesToCheck) {
      const skills = ROLE_SKILLS[role];
      for (const skill of skills) {
        const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
        if (skill === 'R' || skill === 'Go') {
          const strictRegex = new RegExp(`[\\s\\(]${escapedSkill}[\\s\\,\\.\\)]`);
          if (strictRegex.test(text)) extracted.add(skill);
        } else if (regex.test(lowerText)) {
          extracted.add(skill);
        }
      }
    }

    const coreTechSkills = ['Git', 'SQL', 'AWS', 'Docker', 'Agile', 'JavaScript', 'Python'];
    for (const skill of coreTechSkills) {
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      if (regex.test(lowerText)) {
        extracted.add(skill);
      }
    }

    return Array.from(extracted);
  }

  let totalSkillsExtracted = 0;
  let oppsWithSkillsCount = 0;

  for (const opp of opportunities) {
    const extractedSkills = extractRoleSkills(opp.description || '', opp.category || '', opp.title || '');
    if (extractedSkills.length > 0) {
      totalSkillsExtracted += extractedSkills.length;
      oppsWithSkillsCount++;
    }
  }

  const averageSkills = oppsWithSkillsCount > 0 ? (totalSkillsExtracted / opportunities.length).toFixed(1) : 0;

  console.log('--- METRICS ---');
  console.log(`Total opportunities: ${totalInitial}`);
  console.log(`Valid opportunities: ${validLinks}`);
  console.log(`Removed opportunities: ${removedLinks}`);
  console.log(`Broken links removed: ${removedLinks}`);
  console.log(`Duplicate records removed: 0`);
  console.log(`Companies represented: ${companyIds.size}`);
  console.log(`Average skills per opportunity: ${averageSkills}`);
}

runStats();
