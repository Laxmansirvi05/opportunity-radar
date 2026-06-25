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

  // Try to determine the primary role
  let matchedRoles = [];
  if (lowerText.includes('design') || lowerText.includes('ui/ux')) matchedRoles.push('Design');
  if (lowerText.includes('frontend') || lowerText.includes('front-end') || lowerText.includes('react') || lowerText.includes('web dev')) matchedRoles.push('Frontend');
  if (lowerText.includes('backend') || lowerText.includes('back-end') || lowerText.includes('server')) matchedRoles.push('Backend');
  if (lowerText.includes('data') || lowerText.includes('machine learning') || lowerText.includes('ai')) matchedRoles.push('Data Science');
  if (lowerText.includes('product') || lowerText.includes('pm')) matchedRoles.push('Product');
  if (lowerText.includes('mobile') || lowerText.includes('ios') || lowerText.includes('android')) matchedRoles.push('Mobile');
  if (lowerText.includes('devops') || lowerText.includes('site reliability') || lowerText.includes('sre')) matchedRoles.push('DevOps');

  // If no specific role matched, default to checking all (fallback)
  const rolesToCheck = matchedRoles.length > 0 ? matchedRoles : Object.keys(ROLE_SKILLS);

  for (const role of rolesToCheck) {
    const skills = ROLE_SKILLS[role];
    for (const skill of skills) {
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      // Extra checks for generic acronyms to avoid false positives
      if (skill === 'R' || skill === 'Go') {
        const strictRegex = new RegExp(`[\\s\\(]${escapedSkill}[\\s\\,\\.\\)]`);
        if (strictRegex.test(text)) extracted.add(skill);
      } else if (regex.test(lowerText)) {
        extracted.add(skill);
      }
    }
  }

  // Ensure 'SQL' or 'Git' aren't completely ignored if the role is matched differently,
  // but prioritize role-specific skills.
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

async function auditSkills() {
  console.log("Fetching opportunities for skills audit...");

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, title, description, category');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  console.log(`Auditing ${opportunities.length} opportunities...`);

  const sqlFilePath = path.join(process.cwd(), 'skills_update.sql');
  fs.writeFileSync(sqlFilePath, '-- Production DB Skills Update Script\n-- Run this in your Supabase SQL Editor to assign role-specific skills\n\n');
  fs.appendFileSync(sqlFilePath, 'ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS skills jsonb;\n\n');

  let updateCount = 0;

  for (const opp of opportunities) {
    // We only update if we extract skills. 
    // Even if skills exist, the user requested an audit to ensure they are role-specific.
    const extractedSkills = extractRoleSkills(opp.description || '', opp.category || '', opp.title || '');

    if (extractedSkills.length > 0) {
      // Create a JSON string format: '["React", "Next.js"]'
      const jsonStr = JSON.stringify(extractedSkills).replace(/'/g, "''"); // escape single quotes for SQL

      fs.appendFileSync(sqlFilePath, `UPDATE opportunities SET skills = '${jsonStr}'::jsonb WHERE id = '${opp.id}'; -- Extracted: ${extractedSkills.join(', ')}\n`);
      updateCount++;
    }
  }

  console.log(`Audit complete! Generated ${updateCount} UPDATE statements in frontend/skills_update.sql`);
}

auditSkills();
