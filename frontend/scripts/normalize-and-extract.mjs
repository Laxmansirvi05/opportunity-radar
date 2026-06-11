import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const SKILL_KEYWORDS = [
  'Python', 'Java', 'React', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS',
  'JavaScript', 'TypeScript', 'C++', 'C#', 'Docker', 'Kubernetes', 'Azure', 'GCP',
  'HTML', 'CSS', 'Tailwind', 'Next.js', 'Vue', 'Angular', 'Go', 'Rust', 'Swift',
  'Kotlin', 'Android', 'iOS', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
  'REST API', 'Figma', 'UI/UX', 'Data Analysis', 'Excel', 'Tableau', 'Power BI'
];

function extractSkills(text) {
  if (!text) return [];
  const foundSkills = new Set();
  const lowerText = text.toLowerCase();

  for (const skill of SKILL_KEYWORDS) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundSkills.add(skill);
    }
  }
  return Array.from(foundSkills);
}

function normalizeDescription(html) {
  if (!html) return '';
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Format sections explicitly
  clean = clean.replace(/responsibilities/i, '\n\n**Responsibilities:**\n');
  clean = clean.replace(/requirements/i, '\n\n**Requirements:**\n');
  clean = clean.replace(/about the role/i, '\n\n**About the Role:**\n');

  clean = clean.replace(/<br\s*[\/]?>/gi, '\n');
  clean = clean.replace(/<\/p>/gi, '\n\n');
  clean = clean.replace(/<\/li>/gi, '\n');
  clean = clean.replace(/<li>/gi, '• ');
  clean = clean.replace(/<[^>]+>/ig, '');
  clean = clean.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return clean.trim();
}

async function run() {
  console.log("Fetching opportunities for normalization...");

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, description');

  if (error) {
    console.error("Error fetching opportunities:", error);
    return;
  }

  // Fetch tags to see what already exists
  const { data: allTags, error: tagError } = await supabase
    .from('opportunity_tags')
    .select('opportunity_id, tag_name');

  if (tagError) {
    console.error("Error fetching tags:", tagError);
    return;
  }

  const tagMap = new Map();
  for (const tag of allTags) {
    if (!tagMap.has(tag.opportunity_id)) {
      tagMap.set(tag.opportunity_id, new Set());
    }
    tagMap.get(tag.opportunity_id).add(tag.tag_name.toLowerCase());
  }

  console.log(`Processing ${opportunities.length} records...`);
  let updatedCount = 0;
  let descriptionUpdateCount = 0;

  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    const cleanedDesc = normalizeDescription(opp.description);

    // Update description if it's vastly different and valid
    if (cleanedDesc && cleanedDesc !== opp.description && cleanedDesc.length > 50) {
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({ description: cleanedDesc })
        .eq('id', opp.id);

      if (!updateError) {
        descriptionUpdateCount++;
      }
    }

    // Extract skills
    const existingTagsLower = tagMap.get(opp.id) || new Set();
    const extracted = extractSkills(cleanedDesc || opp.description);
    const newTagsToInsert = [];

    for (const ex of extracted) {
      if (!existingTagsLower.has(ex.toLowerCase())) {
        newTagsToInsert.push({ opportunity_id: opp.id, tag_name: ex });
      }
    }

    if (newTagsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('opportunity_tags')
        .insert(newTagsToInsert);

      if (insertError) {
        console.error(`Error inserting tags for ${opp.id}:`, insertError);
      } else {
        updatedCount++;
      }
    }

    if (i > 0 && i % 50 === 0) {
      console.log(`Processed ${i}/${opportunities.length}...`);
    }
  }

  console.log(`Done! Added extracted skills to ${updatedCount} opportunities.`);
  console.log(`Normalized descriptions for ${descriptionUpdateCount} opportunities.`);
}

run();
