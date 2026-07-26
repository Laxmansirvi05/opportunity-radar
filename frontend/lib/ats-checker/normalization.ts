// ---------------------------------------------------------------------------
// Normalization and Aliases for deterministic skill matching
// ---------------------------------------------------------------------------

export const SKILL_ALIASES: Record<string, string[]> = {
  'react': ['reactjs', 'react.js'],
  'node': ['nodejs', 'node.js'],
  'javascript': ['js'],
  'typescript': ['ts'],
  'postgres': ['postgresql'],
  'mongo': ['mongodb'],
  'vue': ['vuejs', 'vue.js'],
  'angular': ['angularjs', 'angular.js'],
  'express': ['expressjs', 'express.js'],
  'next': ['nextjs', 'next.js'],
  'frontend': ['front-end', 'front end'],
  'backend': ['back-end', 'back end'],
  'fullstack': ['full-stack', 'full stack'],
  'k8s': ['kubernetes'],
  'ml': ['machine learning'],
  'ai': ['artificial intelligence'],
  'html': ['html5'],
  'css': ['css3'],
}

// Build a reverse lookup map for O(1) alias resolution
const reverseAliasMap = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    reverseAliasMap.set(alias, canonical)
  }
}

/**
 * Normalizes a skill string: lowercases, trims, and applies canonical aliases.
 */
export function normalizeSkill(skill: string): string {
  const raw = skill.toLowerCase().trim()
    .replace(/[^a-z0-9#+.\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return reverseAliasMap.get(raw) || raw
}

/**
 * Normalizes an array of skills, removing duplicates.
 */
export function normalizeSkillArray(skills: string[]): string[] {
  return [...new Set(skills.map(normalizeSkill).filter((s) => s.length > 0))].sort()
}

/**
 * Normalizes text to extract embedded keywords/skills easily.
 */
export function normalizeText(text?: string): string {
  if (!text) return ''
  return text.toLowerCase().replace(/[^a-z0-9#+.\s-]/g, ' ')
}

/**
 * Normalizes raw resume data (which may be in Reactive Resume's structured format
 * or the older ParsedResume format) into a predictable ParsedResume structure
 * that the ATS scoring engine can safely use without crashing.
 */
export function normalizeToAtsResume(rawData: any) {
  const name = rawData?.name || rawData?.basics?.name || ''
  const email = rawData?.email || rawData?.basics?.email
  const phone = rawData?.phone || rawData?.basics?.phone
  let summary = ''
  if (typeof rawData?.summary === 'string') {
    summary = rawData.summary
  } else if (typeof rawData?.summary?.content === 'string') {
    summary = rawData.summary.content
  } else if (typeof rawData?.basics?.summary === 'string') {
    summary = rawData.basics.summary
  }

  // Process skills: structured items -> flattened string array
  let skills: string[] = []

  const extractSkillsFromItem = (item: any) => {
    if (typeof item === 'string') {
      item.split(/[,;\n]/).forEach((s) => {
        const cleaned = s.replace(/^[-\s•*:-]+/, '').trim()
        if (cleaned) skills.push(cleaned)
      })
    } else if (item && typeof item === 'object') {
      const kwArrays = [item.keywords, item.values, item.list, item.items].filter(Array.isArray)
      kwArrays.forEach((arr) => {
        arr.forEach((kw: any) => {
          if (typeof kw === 'string') {
            kw.split(/[,;\n]/).forEach((s) => {
              const cleaned = s.replace(/^[-\s•*:-]+/, '').trim()
              if (cleaned) skills.push(cleaned)
            })
          }
        })
      })
      if (typeof item.description === 'string' && item.description.trim()) {
        const cleanDesc = item.description.replace(/<[^>]*>?/gm, '').trim()
        cleanDesc.split(/[,;\n]/).forEach((s: string) => {
          const cleaned = s.replace(/^[-\s•*:-]+/, '').trim()
          if (cleaned && cleaned.length < 50) skills.push(cleaned)
        })
      }
      if (typeof item.name === 'string' && item.name.trim()) {
        const cleanName = item.name.trim()
        if (!['programming', 'web', 'tools', 'languages', 'skills', 'ai / data', 'frameworks', 'frontend', 'backend', 'databases', 'cloud', 'libraries'].includes(cleanName.toLowerCase())) {
          skills.push(cleanName)
        }
      }
    }
  }

  if (Array.isArray(rawData?.skills)) {
    rawData.skills.forEach(extractSkillsFromItem)
  }
  if (Array.isArray(rawData?.sections?.skills?.items)) {
    rawData.sections.skills.items.forEach(extractSkillsFromItem)
  }
  skills = [...new Set(skills.map(s => s.trim()).filter(s => s.length > 0))]

  // Process experience
  let experience: any[] = []
  if (Array.isArray(rawData?.experience)) {
    experience = rawData.experience
  } else if (Array.isArray(rawData?.sections?.experience?.items)) {
    experience = rawData.sections.experience.items.map((item: any) => ({
      company: item.company || '',
      role: item.position || '',
      start_date: item.period || '',
      bullets: item.description ? item.description.split(/<br\s*\/?>|\n/).map((s: string) => s.replace(/<[^>]*>?/gm, '').trim()).filter(Boolean) : []
    }))
  }

  // Process projects
  let projects: any[] = []
  if (Array.isArray(rawData?.projects)) {
    projects = rawData.projects
  } else if (Array.isArray(rawData?.sections?.projects?.items)) {
    projects = rawData.sections.projects.items.map((item: any) => {
      const projName = item.name || ''
      const cleanDesc = item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : ''
      let technologies: string[] = []
      if (Array.isArray(item.keywords)) {
        technologies = item.keywords.map(String)
      } else if (projName.includes('|')) {
        const parts = projName.split('|')
        if (parts.length > 1) {
          technologies = parts[1].split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)
        }
      }
      return {
        name: projName,
        title: projName,
        description: cleanDesc,
        technologies,
        bullets: cleanDesc ? cleanDesc.split(/[\n•]/).map((s: string) => s.trim()).filter(Boolean) : []
      }
    })
  }

  // Process education
  let education: any[] = []
  if (Array.isArray(rawData?.education)) {
    education = rawData.education
  } else if (Array.isArray(rawData?.sections?.education?.items)) {
    education = rawData.sections.education.items.map((item: any) => ({
      institution: item.school || item.institution || '',
      degree: item.degree || '',
      degree_level: 'other'
    }))
  }

  // Process certifications
  let certifications: any[] = []
  if (Array.isArray(rawData?.certifications)) {
    certifications = rawData.certifications
  } else if (Array.isArray(rawData?.sections?.certifications?.items)) {
    certifications = rawData.sections.certifications.items.map((item: any) => ({
      name: item.name || item.title || '',
      issuer: item.issuer || item.organization || '',
      date: item.date || item.period || ''
    }))
  }

  return {
    name,
    email,
    phone,
    summary,
    skills,
    experience,
    projects,
    education,
    certifications
  }
}
