import DOMPurify from 'isomorphic-dompurify';

const SKILL_KEYWORDS = [
  'Python', 'Java', 'React', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS',
  'JavaScript', 'TypeScript', 'C++', 'C#', 'Docker', 'Kubernetes', 'Azure', 'GCP',
  'HTML', 'CSS', 'Tailwind', 'Next.js', 'Vue', 'Angular', 'Go', 'Rust', 'Swift',
  'Kotlin', 'Android', 'iOS', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
  'REST API', 'Figma', 'UI/UX', 'Data Analysis', 'Excel', 'Tableau', 'Power BI',
  'Figma', 'Product Management', 'Agile', 'Scrum'
];

export function extractSkillsFromDescription(text: string | null | undefined): string[] {
  if (!text) return [];
  const foundSkills = new Set<string>();
  const lowerText = text.toLowerCase();
  
  for (const skill of SKILL_KEYWORDS) {
    // Escape regex special chars
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundSkills.add(skill);
    }
  }
  return Array.from(foundSkills);
}

export function sanitizeAndFormatDescription(html: string | null | undefined): string {
  if (!html) return '';
  
  // 1. Remove dangerous blocks completely (script, style) before tag stripping
  // so their content doesn't bleed into text
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // 2. Replace semantic breaks
  clean = clean.replace(/<br\s*[\/]?>/gi, '\n');
  clean = clean.replace(/<\/p>/gi, '\n\n');
  clean = clean.replace(/<\/li>/gi, '\n');
  clean = clean.replace(/<li>/gi, '• ');
  
  // 3. Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/ig, '');
  
  // Note: We intentionally DO NOT decode HTML entities (&lt;) manually
  // as this created a Critical XSS vulnerability.
  
  // 4. Format obvious sections with proper UI headings
  clean = clean.replace(/\bresponsibilities[\s:]*/i, '<h3 class="text-lg font-bold text-on-background mt-6 mb-3">Responsibilities</h3>\n');
  clean = clean.replace(/\brequirements[\s:]*/i, '<h3 class="text-lg font-bold text-on-background mt-6 mb-3">Requirements</h3>\n');
  clean = clean.replace(/\babout the role[\s:]*/i, '<h3 class="text-lg font-bold text-on-background mt-6 mb-3">About the Role</h3>\n');
  clean = clean.replace(/\bqualifications[\s:]*/i, '<h3 class="text-lg font-bold text-on-background mt-6 mb-3">Qualifications</h3>\n');
  clean = clean.replace(/\bpreferred skills[\s:]*/i, '<h3 class="text-lg font-bold text-on-background mt-6 mb-3">Preferred Skills</h3>\n');

  // 5. Strip leftover markdown syntax commonly found in descriptions
  clean = clean.replace(/\*\*/g, '');
  clean = clean.replace(/###/g, '');
  clean = clean.replace(/##/g, '');

  // 6. Collapse excessive whitespace
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  // 7. Sanitize final output to ensure no XSS exists (defense in depth)
  return DOMPurify.sanitize(clean.trim(), {
    ALLOWED_TAGS: ['h3'],
    ALLOWED_ATTR: ['class']
  });
}
