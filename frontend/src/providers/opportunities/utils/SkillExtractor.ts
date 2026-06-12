const SKILL_KEYWORDS = [
  'Python', 'Java', 'React', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS',
  'JavaScript', 'TypeScript', 'C++', 'C#', 'Docker', 'Kubernetes', 'Azure', 'GCP',
  'HTML', 'CSS', 'Tailwind', 'Next.js', 'Vue', 'Angular', 'Go', 'Rust', 'Swift',
  'Kotlin', 'Android', 'iOS', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
  'REST API', 'Figma', 'UI/UX', 'Data Analysis', 'Excel', 'Tableau', 'Power BI',
  'Django', 'Flask', 'Spring Boot', 'Express', 'NumPy', 'Pandas', 'TensorFlow', 'PyTorch'
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
