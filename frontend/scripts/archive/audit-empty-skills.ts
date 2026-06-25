import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Extanded skills for repair
const EXTRA_SKILLS = [
  'Management', 'Consulting', 'Finance', 'Accounting', 'Network', 'Security',
  'QA', 'Quality Assurance', 'Content Creation', 'Video Editing', 'Advertising',
  'Event Management', 'Hardware', 'Testing', 'Automation', 'LangGraph', 'Autogen',
  'LLM', 'AI', 'Generative AI', 'Salesforce', 'Business Analysis', 'Public Speaking',
  'Negotiation', 'Market Research', 'Social Media', 'Creative Writing', 'Customer Service',
  'Troubleshooting', 'Technical Support'
];

function extractExtraSkills(text: string): string[] {
  if (!text) return [];
  const foundSkills = new Set<string>();
  const lowerText = text.toLowerCase();
  
  for (const skill of EXTRA_SKILLS) {
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])(${escapedSkill})(?=[^a-zA-Z0-9_]|$)`, 'i');
    if (regex.test(lowerText)) {
      foundSkills.add(skill);
    }
  }
  return Array.from(foundSkills);
}

async function runAudit() {
  console.log("Fetching BEFORE counts...");
  
  // Before query
  const { data: beforeData, error: beforeErr } = await db
    .from('opportunities')
    .select('source')
    .filter('skills', 'eq', '[]');
    
  if (beforeErr) throw beforeErr;
  
  const beforeCounts = beforeData.reduce((acc, row) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("BEFORE COUNTS:");
  console.table(beforeCounts);
  
  // Fetch details for the remaining records
  const { data: records } = await db
    .from('opportunities')
    .select('id, title, description, source, requirements')
    .filter('skills', 'eq', '[]');
    
  if (!records) return;
  
  const classification = {
    short_description: 0,
    no_requirements: 0,
    extraction_failed: 0,
    repaired: 0
  };
  
  const sourceClassification: Record<string, any> = {};
  
  for (const rec of records) {
    const desc = rec.description || '';
    const reqs = rec.requirements || [];
    
    if (!sourceClassification[rec.source]) {
      sourceClassification[rec.source] = { short_description: 0, no_requirements: 0, extraction_failed: 0, repaired: 0 };
    }
    
    const srcClass = sourceClassification[rec.source];
    
    let isShort = false;
    let noReqs = false;
    let extFailed = false;
    
    if (desc.length < 100) {
      classification.short_description++;
      srcClass.short_description++;
      isShort = true;
    }
    
    if (reqs.length === 0 && !desc.toLowerCase().includes('responsibilities') && !desc.toLowerCase().includes('requirements')) {
      classification.no_requirements++;
      srcClass.no_requirements++;
      noReqs = true;
    }
    
    if (!isShort && !noReqs) {
      classification.extraction_failed++;
      srcClass.extraction_failed++;
      extFailed = true;
    }
    
    // Attempt repair
    const combinedText = `${rec.title} ${desc}`;
    const newSkills = extractExtraSkills(combinedText);
    
    if (newSkills.length > 0) {
      const { error } = await db.from('opportunities').update({ skills: newSkills }).eq('id', rec.id);
      if (!error) {
         classification.repaired++;
         srcClass.repaired++;
      }
    }
  }
  
  console.log("\nGLOBAL CLASSIFICATION:");
  console.table(classification);
  
  console.log("\nCLASSIFICATION BY SOURCE:");
  console.table(sourceClassification);
  
  console.log("\nFetching AFTER counts...");
  const { data: afterData } = await db
    .from('opportunities')
    .select('source')
    .filter('skills', 'eq', '[]');
    
  const afterCounts = (afterData || []).reduce((acc, row) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("AFTER COUNTS:");
  console.table(afterCounts);
}

runAudit().catch(console.error);
