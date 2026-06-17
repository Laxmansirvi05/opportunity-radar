const SKILL_KEYWORDS = [
  // Software Engineering
  'Python', 'Java', 'React', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS',
  'JavaScript', 'TypeScript', 'C++', 'C#', 'Docker', 'Kubernetes', 'Azure', 'GCP',
  'HTML', 'CSS', 'Tailwind', 'Next.js', 'Vue', 'Angular', 'Go', 'Rust', 'Swift',
  'Kotlin', 'Android', 'iOS', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
  'REST API', 'Django', 'Flask', 'Spring Boot', 'Express', 'NumPy', 'Pandas', 'TensorFlow', 'PyTorch',
  'Software Development', 'Architecture', 'Design Patterns', 'DevOps', 'CI/CD', 'Linux',
  
  // Data & Analytics
  'Data Analysis', 'Excel', 'Tableau', 'Power BI', 'Data Modeling', 'ETL', 'Hadoop', 'Spark',
  
  // Design
  'Figma', 'UI/UX', 'User Research', 'Wireframing', 'Prototyping', 'Adobe XD', 'Photoshop', 'Illustrator',

  // Management & Operations
  'Leadership', 'Program Management', 'Project Management', 'Agile', 'Scrum', 'Operations',
  'Supply Chain', 'Logistics', 'Process Improvement', 'Strategy', 'Stakeholder Management',
  
  // HR & Recruiting
  'Talent Acquisition', 'Recruiting', 'Candidate Screening', 'Workforce Planning', 'Human Resources', 'Sourcing',

  // Language & Localization
  'Hindi', 'English', 'Localization', 'Translation', 'Content Writing', 'Copywriting', 'Communication',
  
  // Sales & Marketing
  'Marketing', 'Sales', 'Business Development', 'CRM', 'Salesforce', 'SEO', 'SEM', 'Digital Marketing'
];

export class SkillExtractor {
  static extract(text: string): string[] {
    if (!text) return [];
    const foundSkills = new Set<string>();
    const lowerText = text.toLowerCase();

    for (const skill of SKILL_KEYWORDS) {
      // Escape skill for regex to avoid breaking on C++ or Node.js
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // We can't strictly use \\b for word boundaries because it fails on non-word chars like + or #.
      // Instead, we ensure the match is surrounded by whitespace, punctuation, or start/end of string.
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])(${escapedSkill})(?=[^a-zA-Z0-9_]|$)`, 'i');
      
      if (regex.test(lowerText)) {
        foundSkills.add(skill);
      }
    }
    return Array.from(foundSkills);
  }
}
