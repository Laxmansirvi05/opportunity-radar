import type { ParsedResume } from '@/types/resume'
import type { JobMatchResult, AtsCategoryScore, JDExtraction } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import { normalizeSkillArray, normalizeText, SKILL_ALIASES } from './normalization'

export function calculateJobMatch(resume: ParsedResume, jd: JDExtraction): JobMatchResult {
  const reqSkills = evaluateRequiredSkills(resume, jd)
  const roleAlign = evaluateRoleAlignment(resume, jd)
  const expRel = evaluateExperienceRelevance(resume, jd)
  const projEvid = evaluateProjectEvidence(resume, jd)
  const keywordCov = evaluateKeywordCoverage(resume, jd)
  const eduAlign = evaluateEducationAlignment(resume, jd)
  const atsStruct = evaluateAtsStructure(resume)

  const rawScore = 
    reqSkills.score +
    roleAlign.score +
    expRel.score +
    projEvid.score +
    keywordCov.score +
    eduAlign.score +
    atsStruct.score

  // Collate tracked skills
  const listedSkills = normalizeSkillArray(resume.skills || [])
  const evidencedSet = new Set<string>()
  const listedSet = new Set<string>()
  const missingReqSet = new Set<string>()
  const missingPrefSet = new Set<string>()
  
  const allReq = jd.requiredSkills.map(s => normalizeText(s))
  const allPref = jd.preferredSkills.map(s => normalizeText(s))
  
  allReq.forEach(skill => {
    if (isSkillEvidenced(skill, resume)) evidencedSet.add(skill)
    else if (listedSkills.includes(skill)) listedSet.add(skill)
    else missingReqSet.add(skill)
  })

  allPref.forEach(skill => {
    if (isSkillEvidenced(skill, resume)) evidencedSet.add(skill)
    else if (listedSkills.includes(skill)) listedSet.add(skill)
    else missingPrefSet.add(skill)
  })

  const hardRequirements = evaluateHardRequirements(resume, jd)

  return {
    score: Math.min(100, Math.max(0, Math.round(rawScore))),
    evidencedSkills: Array.from(evidencedSet),
    listedSkills: Array.from(listedSet),
    missingRequiredSkills: Array.from(missingReqSet),
    missingPreferredSkills: Array.from(missingPrefSet),
    hardRequirements,
    categories: {
      requiredSkills: reqSkills,
      roleAlignment: roleAlign,
      experienceRelevance: expRel,
      projectEvidence: projEvid,
      keywordCoverage: keywordCov,
      educationAlignment: eduAlign,
      atsStructure: atsStruct
    }
  }
}

function getSafeText(val: any): string {
  if (typeof val === 'string') return val.toLowerCase()
  if (Array.isArray(val)) return val.map(getSafeText).join(' ')
  if (typeof val === 'object' && val !== null) {
    return Object.values(val).map(getSafeText).join(' ')
  }
  return ''
}

function getExperienceAndProjectsText(resume: ParsedResume): string {
  return getSafeText(resume.experience) + ' ' + getSafeText(resume.projects)
}

function isSkillEvidenced(skill: string, resume: ParsedResume): boolean {
  if (!skill) return false
  const rawText = getExperienceAndProjectsText(resume)
  
  const aliases = SKILL_ALIASES[skill] || []
  const allTerms = [skill, ...aliases]

  for (const term of allTerms) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\W)${escapedTerm}(?:\\W|$)`, 'i')
    if (regex.test(rawText)) return true
  }
  
  return false
}

// ---------------------------------------------------------------------------
// 1. Required Skills & Technologies (30 points)
// ---------------------------------------------------------------------------
function evaluateRequiredSkills(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 30
  if (!jd.requiredSkills || jd.requiredSkills.length === 0) {
    return { score: maxScore, maxScore, evidence: ['No required skills specified in JD.'], deductions: [] }
  }

  const normalizedResumeSkills = normalizeSkillArray(resume.skills || [])
  const evidence: string[] = []
  const deductions: string[] = []
  
  let matchScore = 0
  const uniqueRequired = Array.from(new Set(jd.requiredSkills.map(s => normalizeText(s)).filter(s => s.length > 0)))
  
  if (uniqueRequired.length === 0) {
    return { score: maxScore, maxScore, evidence: ['No valid required skills extracted.'], deductions: [] }
  }
  
  const pointsPerSkill = maxScore / uniqueRequired.length

  uniqueRequired.forEach(reqSkill => {
    const isListed = normalizedResumeSkills.includes(reqSkill)
    const isEvidenced = isSkillEvidenced(reqSkill, resume)

    if (isEvidenced) {
      matchScore += pointsPerSkill
      evidence.push(`Evidenced — ${reqSkill}`)
    } else if (isListed) {
      matchScore += (pointsPerSkill * 0.5)
      deductions.push(`Listed only (No Evidence) — ${reqSkill}`)
    } else {
      deductions.push(`Missing — ${reqSkill}`)
    }
  })

  return { 
    score: Math.min(maxScore, Math.round(matchScore)), 
    maxScore, 
    evidence, 
    deductions 
  }
}

// ---------------------------------------------------------------------------
// 2. Role / Responsibility Alignment (20 points)
// ---------------------------------------------------------------------------
function evaluateRoleAlignment(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 20
  const evidence: string[] = []
  const deductions: string[] = []
  let score = 0

  const roleFamily = normalizeText(jd.roleFamily)
  const targetRole = normalizeText(jd.targetRole)
  const resumeText = getSafeText(resume)
  
  const hasTargetRole = targetRole.length > 0 && resumeText.includes(targetRole)
  const hasRoleFamily = roleFamily.length > 0 && resumeText.includes(roleFamily)
  
  if (hasTargetRole) {
    score += 10
    evidence.push(`Strong alignment: target role "${targetRole}" found in resume.`)
  } else if (hasRoleFamily) {
    score += 5
    evidence.push(`Partial alignment: role family "${roleFamily}" found.`)
    deductions.push(`Target role "${targetRole}" not explicitly mentioned.`)
  } else {
    deductions.push(`Resume does not explicitly mention the target role or role family.`)
  }

  let respMatch = 0
  const totalResps = jd.responsibilities.length
  if (totalResps > 0) {
    jd.responsibilities.forEach(resp => {
      const tokens = normalizeText(resp).split(' ').filter(t => t.length > 4)
      if (tokens.length > 0 && tokens.some(t => resumeText.includes(t))) {
        respMatch++
      }
    })
    const respRatio = respMatch / totalResps
    if (respRatio >= 0.5) {
      score += 10
      evidence.push(`Strong overlap with stated responsibilities.`)
    } else if (respRatio > 0) {
      score += 5
      evidence.push(`Partial overlap with stated responsibilities.`)
      deductions.push(`Missing evidence for some key responsibilities.`)
    } else {
      deductions.push(`Weak or no overlap with listed responsibilities.`)
    }
  } else {
    score += 10 
  }

  return { score: Math.min(maxScore, score), maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// 3. Experience Relevance (15 points)
// ---------------------------------------------------------------------------
function evaluateExperienceRelevance(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []
  let score = 0

  let totalMonths = 0
  const exp = resume.experience || []
  
  const allKeywords = [jd.targetRole, jd.roleFamily, ...jd.requiredSkills].map(normalizeText).filter(Boolean)

  exp.forEach(e => {
    const eText = getSafeText(e)
    const isRelevant = allKeywords.some(kw => eText.includes(kw))

    if (e.start_date && isRelevant) {
      const start = new Date(e.start_date).getTime()
      const end = e.end_date ? new Date(e.end_date).getTime() : Date.now()
      if (!isNaN(start) && !isNaN(end) && end > start) {
        totalMonths += (end - start) / (1000 * 60 * 60 * 24 * 30)
      } else {
        totalMonths += 6 
      }
    }
  })

  const jdTextLower = (jd.targetRole + ' ' + jd.keywords?.join(' ') + ' ' + jd.responsibilities?.join(' ')).toLowerCase()
  const targetsFresher = jdTextLower.includes('intern') || jdTextLower.includes('student') || jdTextLower.includes('fresher') || jdTextLower.includes('entry') || jdTextLower.includes('new grad')

  if (!jd.minimumExperienceMonths) {
    score = maxScore
    evidence.push('JD does not require a minimum amount of professional experience.')
  } else {
    if (totalMonths >= jd.minimumExperienceMonths) {
      score = maxScore
      evidence.push(`Meets minimum experience requirement (~${Math.round(totalMonths)} months).`)
    } else if (targetsFresher) {
      score = maxScore
      evidence.push(`JD targets student/fresher; full experience credit awarded despite short duration.`)
    } else if (totalMonths > 0) {
      score = Math.round(maxScore * (totalMonths / jd.minimumExperienceMonths))
      deductions.push(`Falls short of minimum experience (~${Math.round(totalMonths)} / ${jd.minimumExperienceMonths} months).`)
    } else {
      deductions.push('No professional experience dates found.')
    }
  }

  return { score, maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// 4. Project Evidence (15 points)
// ---------------------------------------------------------------------------
function evaluateProjectEvidence(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []
  let score = 0

  const projects = resume.projects || []
  if (projects.length === 0) {
    deductions.push('No projects found. Projects provide vital evidence of practical skills.')
    return { score: 0, maxScore, evidence, deductions }
  }

  const reqSkills = jd.requiredSkills.map(normalizeText).filter(Boolean)
  const prefSkills = jd.preferredSkills.map(normalizeText).filter(Boolean)
  const targetRole = normalizeText(jd.targetRole)
  
  let totalTechMatches = 0
  let highlyRelevant = 0
  const creditedTech = new Set<string>()

  projects.forEach(p => {
    const pText = getSafeText(p)
    let projMatches = 0

    const checkTech = (tech: string) => {
      if (tech.length > 0 && pText.includes(tech)) {
        if (!creditedTech.has(tech)) {
          creditedTech.add(tech)
          projMatches++
        }
      }
    }

    reqSkills.forEach(checkTech)
    prefSkills.forEach(checkTech)

    if (projMatches >= 1 || (targetRole && pText.includes(targetRole))) {
      highlyRelevant++
    }
    totalTechMatches += projMatches
  })

  if (highlyRelevant > 0 || totalTechMatches > 0) {
    score = Math.min(maxScore, highlyRelevant * 5 + creditedTech.size * 2) 
    evidence.push(`Found ${projects.length} project(s) demonstrating ${creditedTech.size} target technologies.`)
  } else {
    score = 0 
    deductions.push('Projects do not strongly demonstrate requested technologies.')
  }

  return { score: Math.min(maxScore, score), maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// 5. Keyword / Context Coverage (10 points)
// ---------------------------------------------------------------------------
function evaluateKeywordCoverage(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 10
  if (!jd.keywords || jd.keywords.length === 0) {
    return { score: maxScore, maxScore, evidence: ['No specific contextual keywords to evaluate.'], deductions: [] }
  }

  const evidence: string[] = []
  const deductions: string[] = []
  const resumeText = getSafeText(resume)
  
  let matches = 0
  const uniqueKeywords = Array.from(new Set(jd.keywords.map(k => normalizeText(k)).filter(k => k.length > 3)))
  
  if (uniqueKeywords.length === 0) {
    return { score: maxScore, maxScore, evidence: ['Keywords too generic.'], deductions: [] }
  }
  
  const pointsPerKeyword = maxScore / uniqueKeywords.length

  uniqueKeywords.forEach(kw => {
    if (resumeText.includes(kw)) {
      matches++
      evidence.push(`Context Match: ${kw}`)
    } else {
      deductions.push(`Missing Context: ${kw}`)
    }
  })

  return { 
    score: Math.min(maxScore, Math.round(matches * pointsPerKeyword)), 
    maxScore, 
    evidence, 
    deductions 
  }
}

// ---------------------------------------------------------------------------
// 6. Education / Eligibility (5 points)
// ---------------------------------------------------------------------------
function evaluateEducationAlignment(resume: ParsedResume, jd: JDExtraction): AtsCategoryScore {
  const maxScore = 5
  const evidence: string[] = []
  const deductions: string[] = []

  if (!jd.educationRequirements || jd.educationRequirements === 'none') {
    return { score: maxScore, maxScore, evidence: ['No specific education level required.'], deductions: [] }
  }

  const reqLevels = { 'none': 0, 'other': 0, 'diploma': 1, 'bachelors': 3, 'masters': 4, 'doctorate': 5 }
  const reqValue = reqLevels[jd.educationRequirements as keyof typeof reqLevels] || 0

  let highestLevel = 0
  const edu = resume.education || []
  
  edu.forEach(e => {
    const levelStr = e.degree_level?.toLowerCase() || ''
    const val = reqLevels[levelStr as keyof typeof reqLevels]
    if (val && val > highestLevel) highestLevel = val
    
    const text = (e.degree + ' ' + e.institution).toLowerCase()
    if (text.includes('phd') || text.includes('doctor')) highestLevel = Math.max(highestLevel, 5)
    else if (text.includes('master') || text.includes('ms ')) highestLevel = Math.max(highestLevel, 4)
    else if (text.includes('bachelor') || text.includes('bs ') || text.includes('b.tech') || text.includes('b.s')) highestLevel = Math.max(highestLevel, 3)
    else if (text.includes('diploma') || text.includes('associate')) highestLevel = Math.max(highestLevel, 1)
  })

  if (highestLevel >= reqValue) {
    evidence.push(`Meets education requirement (${jd.educationRequirements}).`)
    return { score: maxScore, maxScore, evidence, deductions }
  } else if (highestLevel > 0) {
    deductions.push(`Education level may not meet requirement (Target: ${jd.educationRequirements}).`)
    return { score: Math.round(maxScore * 0.5), maxScore, evidence, deductions }
  } else {
    deductions.push('Could not definitively determine education level.')
    return { score: 0, maxScore, evidence, deductions }
  }
}

// ---------------------------------------------------------------------------
// 7. ATS Structure / Machine Readability (5 points)
// ---------------------------------------------------------------------------
function evaluateAtsStructure(resume: ParsedResume): AtsCategoryScore {
  const maxScore = 5
  const evidence: string[] = []
  const deductions: string[] = []
  let score = 5

  const hasEmptyExp = resume.experience?.some(e => !e.company && !e.role && (!e.bullets || e.bullets.length === 0))
  const hasEmptyEdu = resume.education?.some(e => !e.institution && !e.degree)
  const hasEmptyProj = resume.projects?.some(e => !e.name && !e.description)

  if (hasEmptyExp || hasEmptyEdu || hasEmptyProj) {
    score -= 3
    deductions.push('Detected corrupted or empty entries during parsing.')
  }

  if (score === 5) {
    evidence.push('Cleanly extracted structured data with no corrupted sections.')
  }

  return { score: Math.max(0, score), maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Hard Requirements Evaluation
// ---------------------------------------------------------------------------
function evaluateHardRequirements(resume: ParsedResume, jd: JDExtraction) {
  if (!jd.hardRequirements || jd.hardRequirements.length === 0) return []

  const rawText = getSafeText(resume)
  
  return jd.hardRequirements.map(req => {
    let status: 'Met'|'Not Met'|'Unknown' = 'Unknown'
    const ruleLower = req.rule.toLowerCase()
    
    const yearMatch = req.rule.match(/\b(20\d\d)\b/)
    if (yearMatch && rawText.includes(yearMatch[1])) {
      status = 'Unknown'
    } else {
      const keyNouns = ruleLower.replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 4 && !['requires', 'must', 'have', 'need'].includes(w))
      if (keyNouns.length > 0) {
        const matchCount = keyNouns.filter(kn => rawText.includes(kn)).length
        if (matchCount === 0) {
          status = 'Not Met' 
        } else {
          status = 'Unknown'
        }
      }
    }
    
    return { rule: req.rule, status }
  })
}
