import type { ParsedResume } from '@/types/resume'
import type { AtsReadinessResult, AtsCategoryScore } from '@/features/resume-toolkit/lib/schema/resume/ats-check'
import { normalizeText } from './normalization'
import { stringList } from '@/lib/resume-fields'



const ACTION_VERBS = new Set([
  'achieved', 'added', 'administered', 'advised', 'analyzed', 'architected', 'built',
  'collaborated', 'completed', 'configured', 'constructed', 'created', 'delivered',
  'designed', 'developed', 'directed', 'engineered', 'enhanced', 'established',
  'executed', 'facilitated', 'formulated', 'generated', 'guided', 'headed',
  'implemented', 'improved', 'increased', 'initiated', 'innovated', 'integrated',
  'led', 'managed', 'maximized', 'mentored', 'modernized', 'optimized', 'orchestrated',
  'overhauled', 'performed', 'pioneered', 'planned', 'produced', 'programmed',
  'reduced', 'resolved', 'revamped', 'saved', 'scaled', 'secured', 'simplified',
  'spearheaded', 'streamlined', 'structured', 'succeeded', 'transformed', 'upgraded',
  'utilized', 'won', 'wrote', 'launched', 'deployed'
])

export function calculateAtsReadiness(resume: ParsedResume): AtsReadinessResult {
  const coreSections = evaluateCoreSections(resume)
  const parsability = evaluateParsability(resume)
  const contentQuality = evaluateContentQuality(resume)
  const impact = evaluateImpact(resume)
  const skills = evaluateSkills(resume)
  const professionalQuality = evaluateProfessionalQuality(resume)

  const rawScore = 
    coreSections.score +
    parsability.score +
    contentQuality.score +
    impact.score +
    skills.score +
    professionalQuality.score

  return {
    score: Math.min(100, Math.max(0, Math.round(rawScore))),
    categories: {
      coreSections,
      parsability, // Renamed to "Structure & Machine Readability" in UI later
      contentQuality,
      impact,
      skills,
      professionalQuality
    }
  }
}

// ---------------------------------------------------------------------------
// Core Sections & Completeness (20 points)
// ---------------------------------------------------------------------------
function evaluateCoreSections(resume: ParsedResume): AtsCategoryScore {
  let score = 0
  const maxScore = 20
  const evidence: string[] = []
  const deductions: string[] = []

  // Contact Info (4 points) - Don't count summary here to avoid double counting
  let contactScore = 0
  if (resume.name?.trim()) contactScore += 1
  if (resume.email?.trim()) contactScore += 2
  if (resume.phone?.trim()) contactScore += 1
  
  if (contactScore === 4) {
    score += 4
    evidence.push('Core contact info is complete.')
  } else {
    score += contactScore
    deductions.push('Missing essential contact information (name, email, or phone).')
  }

  // Education (4 points)
  const validEdu = (resume.education || []).filter(e => e.institution?.trim() || e.degree?.trim())
  if (validEdu.length > 0) {
    score += 4
    evidence.push(`Found ${validEdu.length} meaningful education entries.`)
  } else {
    deductions.push('Education section is empty or lacks meaningful details.')
  }

  // Experience / Projects (8 points) - Student Focused
  const validExp = (resume.experience || []).filter(e => e.company?.trim() || e.role?.trim())
  const validProj = (resume.projects || []).filter(p => p.name?.trim() || p.description?.trim())
  
  if (validExp.length > 0 && validProj.length > 0) {
    score += 8
    evidence.push(`Found both formal experience and meaningful projects.`)
  } else if (validExp.length > 0) {
    score += 8
    evidence.push(`Found formal experience entries.`)
  } else if (validProj.length > 0) {
    score += 8
    evidence.push(`Found meaningful projects, demonstrating practical ability.`)
  } else {
    deductions.push('Missing both professional experience and project work.')
  }

  // Skills (4 points)
  const validSkills = (resume.skills || []).filter(s => s.trim().length > 1)
  if (validSkills.length > 0) {
    score += 4
    evidence.push(`Found technical/professional skills section.`)
  } else {
    deductions.push('Skills section is missing or empty.')
  }

  return { score, maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Structure & Machine Readability (15 points)
// ---------------------------------------------------------------------------
function evaluateParsability(resume: ParsedResume): AtsCategoryScore {
  let score = 15
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []

  // Check for extraction corruption or empty arrays masquerading as data
  const hasEmptyExp = resume.experience?.some(e => !e.company && !e.role && (!e.bullets || e.bullets.length === 0))
  const hasEmptyEdu = resume.education?.some(e => !e.institution && !e.degree)
  const hasEmptyProj = resume.projects?.some(e => !e.name && !e.description)

  if (hasEmptyExp) {
    score -= 5
    deductions.push('Detected corrupted or empty experience entries.')
  }
  if (hasEmptyEdu) {
    score -= 5
    deductions.push('Detected corrupted or empty education entries.')
  }
  if (hasEmptyProj) {
    score -= 5
    deductions.push('Detected corrupted or empty project entries.')
  }

  if (score === 15) {
    evidence.push('Cleanly extracted structured data with no corrupted sections.')
  } else {
    score = Math.max(0, score)
  }

  return { score, maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Content Quality (20 points)
// ---------------------------------------------------------------------------
function evaluateContentQuality(resume: ParsedResume): AtsCategoryScore {
  let score = 20
  const maxScore = 20
  const evidence: string[] = []
  const deductions: string[] = []

  const allBullets = [
    ...(resume.experience || []).flatMap(e => e.bullets || []),
    ...(resume.projects || []).map(p => p.description || ''),
    ...(resume.projects || []).flatMap((p) => stringList(p, 'bullets'))
  ].filter(b => b.trim().length > 0)

  if (allBullets.length === 0) {
    score -= 15
    deductions.push('No bullet points or descriptions found in experience or projects.')
    return { score: Math.max(0, score), maxScore, evidence, deductions }
  }
  
  evidence.push(`Analyzed ${allBullets.length} bullet points and descriptions.`)

  let shortBullets = 0
  let keywordLists = 0
  let duplicates = 0
  const seenBullets = new Set<string>()

  allBullets.forEach(b => {
    const trimmed = b.trim()
    const words = trimmed.split(' ')
    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    if (seenBullets.has(normalized) && normalized.length > 10) {
      duplicates++
    }
    seenBullets.add(normalized)

    if (words.length < 5) {
      shortBullets++
    }

    // Check if it's just a keyword list (e.g., "React Node AWS Docker")
    // Usually these lack small connecting words (a, the, in, with, using, to, for, and)
    const stopWords = ['a', 'the', 'in', 'with', 'using', 'to', 'for', 'and', 'of', 'by', 'on', 'at']
    const hasStopWords = words.some((w: string) => stopWords.includes(w.toLowerCase()))
    if (!hasStopWords && words.length > 3) {
      keywordLists++
    }
  })

  if (shortBullets > 0) {
    const penalty = Math.min(8, shortBullets * 2)
    score -= penalty
    deductions.push(`${shortBullets} bullets/descriptions are too brief (< 5 words).`)
  }

  if (keywordLists > 0) {
    const penalty = Math.min(8, keywordLists * 2)
    score -= penalty
    deductions.push(`${keywordLists} bullets appear to be keyword lists rather than meaningful achievements.`)
  }

  if (duplicates > 0) {
    score -= Math.min(10, duplicates * 3)
    deductions.push(`Found ${duplicates} duplicated bullet points/descriptions.`)
  }

  return { score: Math.max(0, score), maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Impact & Achievements (15 points)
// ---------------------------------------------------------------------------
function evaluateImpact(resume: ParsedResume): AtsCategoryScore {
  let score = 0
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []

  const allBullets = [
    ...(resume.experience || []).flatMap(e => e.bullets || []),
    ...(resume.projects || []).map(p => p.description || ''),
    ...(resume.projects || []).flatMap((p) => stringList(p, 'bullets'))
  ].filter(b => b.trim().length > 0)

  if (allBullets.length < 3) {
    deductions.push('Not enough bullets/descriptions to evaluate impact (need at least 3).')
    // Score proportionally for very few bullets, max 5 points
    score = Math.min(5, allBullets.length * 2)
    return { score, maxScore, evidence, deductions }
  }

  let actionCount = 0
  let metricCount = 0

  // Regex to avoid counting years (202x, 201x, 200x) or versions (React 18, Vue 3, Node 20)
  // Look for %, $, +, x, or standard numbers that aren't isolated years or 1-3 digits after common tech words.
  const isMetric = (text: string) => {
    if (/%|\$|\+/.test(text)) return true
    
    // Check for words indicating growth/scale/impact alongside numbers
    const lower = text.toLowerCase()
    if (/\b(improved|increased|reduced|decreased|latency|users|clients|records|data|revenue|features|accuracy)\b/.test(lower) && /\d/.test(lower)) {
      return true
    }

    return false
  }

  allBullets.forEach(b => {
    const firstWord = b.trim().split(' ')[0]?.toLowerCase()?.replace(/[^a-z]/g, '')
    if (firstWord && ACTION_VERBS.has(firstWord)) {
      actionCount++
    }
    if (isMetric(b)) {
      metricCount++
    }
  })

  evidence.push(`Evaluated ${allBullets.length} total points of evidence.`)

  // Action verbs score (max 7)
  const actionRatio = actionCount / allBullets.length
  if (actionRatio >= 0.7) {
    score += 7
    evidence.push('Strong use of action verbs.')
  } else if (actionRatio >= 0.4) {
    score += 4
    deductions.push('Many bullets lack strong action verbs.')
  } else {
    score += 1
    deductions.push('Mostly missing action verbs at the start of sentences.')
  }

  // Metric score (max 8)
  const metricRatio = metricCount / allBullets.length
  if (metricRatio >= 0.25) {
    score += 8
    evidence.push('Good use of quantifiable metrics and outcomes.')
  } else if (metricRatio >= 0.1) {
    score += 4
    deductions.push('Could use more quantifiable outcomes/metrics.')
  } else {
    score += 0
    deductions.push('Severely lacking quantifiable outcomes/metrics.')
  }

  return { score, maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Skills & Technical Presentation (15 points)
// ---------------------------------------------------------------------------
function evaluateSkills(resume: ParsedResume): AtsCategoryScore {
  let score = 15
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []

  const rawSkills = (resume.skills || []).map(s => s.trim()).filter(Boolean)
  if (rawSkills.length === 0) {
    return { score: 0, maxScore, evidence: [], deductions: ['No skills section found.'] }
  }

  const uniqueSkills = new Set(rawSkills.map(s => normalizeText(s)))
  const skillCount = uniqueSkills.size

  evidence.push(`Found ${skillCount} unique skills listed.`)

  if (skillCount < 4) {
    score -= 8
    deductions.push('Very few skills listed. Consider adding more core competencies.')
  } else if (skillCount > 35) {
    score -= 5
    deductions.push('Excessive number of skills listed. Quality over quantity is preferred.')
  }

  // Check if skills are actually demonstrated in experience/projects
  const rawText = (JSON.stringify(resume.experience) + JSON.stringify(resume.projects)).toLowerCase()
  
  let unmentioned = 0
  uniqueSkills.forEach(s => {
    if (!rawText.includes(s)) {
      unmentioned++
    }
  })

  // If someone lists 40 skills but only mentions 5, they lose heavily.
  // If they list 15 and mention 10, they keep most points.
  const mentionedRatio = (skillCount - unmentioned) / skillCount
  
  if (mentionedRatio < 0.2) {
    score -= 10
    deductions.push('Almost none of your listed skills are demonstrated in your experience/projects.')
  } else if (mentionedRatio < 0.5) {
    score -= 5
    deductions.push('Many listed skills are never mentioned in your experience or projects.')
  } else {
    evidence.push('Solid alignment between listed skills and demonstrated experience.')
  }

  return { score: Math.max(0, score), maxScore, evidence, deductions }
}

// ---------------------------------------------------------------------------
// Professional Quality (15 points)
// ---------------------------------------------------------------------------
function evaluateProfessionalQuality(resume: ParsedResume): AtsCategoryScore {
  let score = 15
  const maxScore = 15
  const evidence: string[] = []
  const deductions: string[] = []

  // Summary quality
  // A summary is either a plain string or the builder's { content } object.
  const summaryContent = (resume.summary as { content?: unknown } | null | undefined)?.content
  const summaryStr =
    typeof resume.summary === 'string'
      ? resume.summary
      : typeof summaryContent === 'string'
        ? summaryContent
        : ''
  if (summaryStr && summaryStr.trim().length > 0) {
    if (summaryStr.length < 40) {
      score -= 3
      deductions.push('Professional summary is too brief to be impactful.')
    } else if (summaryStr.length > 600) {
      score -= 3
      deductions.push('Professional summary is overly long and may not be read.')
    } else {
      evidence.push('Professional summary is well-crafted.')
    }
  } else {
    // Missing summary is ok for freshers, but minor deduction for professionals.
    // Core sections doesn't penalize summary explicitly, so a small deduction here is fine.
    score -= 2
    deductions.push('Missing a professional summary.')
  }

  const rawLower = JSON.stringify(resume).toLowerCase()
  
  // Check for placeholder text
  if (rawLower.includes('lorem ipsum') || rawLower.includes('placeholder')) {
    score -= 12
    deductions.push('Found placeholder text (Lorem ipsum).')
  }

  // Check for excessive buzzwords that don't add value
  const buzzwords = ['synergy', 'go-getter', 'thought leader', 'results-driven', 'detail-oriented', 'hard worker']
  const buzzCount = buzzwords.filter(bw => rawLower.includes(bw)).length
  if (buzzCount >= 2) {
    score -= 3
    deductions.push('Overuse of generic buzzwords (e.g., detail-oriented, synergy).')
  }

  // Check consistent capitalization (rough heuristic)
  const allText = rawLower
  const JS_VARIANTS = ['javascript', 'java script'] // If both exist, it's inconsistent
  if (JS_VARIANTS.every(v => allText.includes(v))) {
    score -= 2
    deductions.push('Inconsistent terminology detected (e.g. JavaScript formatting).')
  }

  return { score: Math.max(0, score), maxScore, evidence, deductions }
}
