import type { ParsedResume } from '@/types/resume'
import type { EvidenceReference, EvidenceMatrix } from '../../lib/schema/resume/ats-v2'

export interface VerificationResult {
  isValid: boolean
  reason?: string
}

export function extractAllResumeTextSnippets(resume: ParsedResume): string[] {
  const snippets: string[] = []

  if (resume.summary) snippets.push(resume.summary.toLowerCase())
  if (resume.name) snippets.push(resume.name.toLowerCase())

  if (resume.skills && Array.isArray(resume.skills)) {
    for (const skill of resume.skills) {
      if (typeof skill === 'string') {
        snippets.push(skill.toLowerCase())
      } else if (skill && typeof skill === 'object') {
        if ((skill as any).name && typeof (skill as any).name === 'string') {
          snippets.push((skill as any).name.toLowerCase())
        }
        if (Array.isArray((skill as any).keywords)) {
          for (const kw of (skill as any).keywords) {
            if (typeof kw === 'string') snippets.push(kw.toLowerCase())
          }
        }
      }
    }
  }

  if (resume.experience && Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      if (exp.company) snippets.push(exp.company.toLowerCase())
      if (exp.role) snippets.push(exp.role.toLowerCase())
      const bullets = (exp as any).bullets || (exp as any).highlights || []
      if (Array.isArray(bullets)) {
        for (const h of bullets) {
          if (typeof h === 'string') snippets.push(h.toLowerCase())
        }
      }
    }
  }

  if (resume.projects && Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      if (proj.name) snippets.push(proj.name.toLowerCase())
      if (proj.description) snippets.push(proj.description.toLowerCase())
      if (proj.technologies && Array.isArray(proj.technologies)) {
        for (const t of proj.technologies) {
          if (t) snippets.push(t.toLowerCase())
        }
      }
      const projHighlights = (proj as any).highlights || []
      if (Array.isArray(projHighlights)) {
        for (const h of projHighlights) {
          if (typeof h === 'string') snippets.push(h.toLowerCase())
        }
      }
    }
  }

  if (resume.education && Array.isArray(resume.education)) {
    for (const edu of resume.education) {
      if (edu.institution) snippets.push(edu.institution.toLowerCase())
      if (edu.degree) snippets.push(edu.degree.toLowerCase())
      if (edu.field) snippets.push(edu.field.toLowerCase())
    }
  }

  if ((resume as any).certifications && Array.isArray((resume as any).certifications)) {
    for (const cert of (resume as any).certifications) {
      if (typeof cert === 'string') snippets.push(cert.toLowerCase())
      else if (cert && typeof cert === 'object') {
        if (cert.name) snippets.push(String(cert.name).toLowerCase())
        if (cert.title) snippets.push(String(cert.title).toLowerCase())
        if (cert.issuer) snippets.push(String(cert.issuer).toLowerCase())
      }
    }
  }

  if ((resume as any).awards && Array.isArray((resume as any).awards)) {
    for (const award of (resume as any).awards) {
      if (typeof award === 'string') snippets.push(award.toLowerCase())
      else if (award && typeof award === 'object') {
        if (award.name) snippets.push(String(award.name).toLowerCase())
        if (award.title) snippets.push(String(award.title).toLowerCase())
      }
    }
  }

  return snippets
}

export function verifyEvidence(
  resume: ParsedResume,
  reference: EvidenceReference
): VerificationResult {
  if (!reference || !reference.exactText || !reference.exactText.trim()) {
    return { isValid: false, reason: 'Evidence exactText is empty' }
  }

  const exactLower = reference.exactText.trim().toLowerCase()
  
  // PRIMARY SOURCE OF TRUTH: rawText
  if ((resume as any).rawText) {
    const rawLower = ((resume as any).rawText as string).toLowerCase()
    
    // 1. Direct inclusion match
    if (rawLower.includes(exactLower)) {
      return { isValid: true }
    }
    
    // 2. Token match: check if key skill/word tokens in exact text exist in rawText
    const words = exactLower
      .split(/[\s,;|:/\\()-]+/)
      .map((w: string) => w.trim())
      .filter((w: string) => w.length > 0 && !['and', 'with', 'the', 'for', 'in', 'of', 'to', 'a', 'an', 'or', 'on', 'at', 'is', 'using', 'experience', 'knowledge', 'proficient', 'understanding'].includes(w))

    if (words.length > 0) {
      const matchesRawText = words.some((word) => rawLower.includes(word))
      if (matchesRawText) {
        return { isValid: true }
      }
    }
  }

  // FALLBACK: Structured Snippets
  const allSnippets = extractAllResumeTextSnippets(resume)

  // 1. Direct inclusion match: exact text present within any resume snippet
  if (allSnippets.some((snippet) => snippet.includes(exactLower))) {
    return { isValid: true }
  }

  // 2. Reverse inclusion: snippet is contained within exactLower phrase
  if (allSnippets.some((snippet) => snippet.length >= 3 && exactLower.includes(snippet))) {
    return { isValid: true }
  }

  // 3. Token match: check if key skill/word tokens in exact text exist in any snippet
  const words = exactLower
    .split(/[\s,;|:/\\()-]+/)
    .map((w: string) => w.trim())
    .filter((w: string) => w.length > 0 && !['and', 'with', 'the', 'for', 'in', 'of', 'to', 'a', 'an', 'or', 'on', 'at', 'is', 'using', 'experience', 'knowledge', 'proficient', 'understanding'].includes(w))

  if (words.length === 0) {
    return { isValid: false, reason: 'Exact text contains no meaningful words' }
  }

  const matchesAnySnippet = allSnippets.some((snippet) => {
    return words.some((word) => snippet.includes(word))
  })

  if (matchesAnySnippet) {
    return { isValid: true }
  }

  return {
    isValid: false,
    reason: `Claimed evidence text "${reference.exactText}" was not found in the resume.`,
  }
}

export function sanitizeEvidenceMatrix(
  resume: ParsedResume,
  matrix: EvidenceMatrix
): { sanitizedMatrix: EvidenceMatrix; rejectedCount: number } {
  let rejectedCount = 0

  const sanitizedEvaluations = matrix.evaluations.map((evaluation: any) => {
    const validReferences = (evaluation.evidenceReferences || [])
      .filter((ref: EvidenceReference) => {
        const v = verifyEvidence(resume, ref)
        if (!v.isValid) {
          rejectedCount++
          return false
        }
        return true
      })
      .map((ref: EvidenceReference) => {
        // Ensure quantifiedImpact is actually supported by the exactText
        if (ref.quantifiedImpact && ref.quantifiedImpact.trim()) {
          const impactLower = ref.quantifiedImpact.trim().toLowerCase()
          const exactLower = (ref.exactText || '').toLowerCase()
          const impactNumbers = impactLower.match(/\d+(?:\.\d+)?/g) || []
          const hasMetricInText = impactNumbers.some((num) => exactLower.includes(num))
          if (!hasMetricInText && !exactLower.includes(impactLower)) {
            return { ...ref, quantifiedImpact: null }
          }
        }
        return ref
      })

    if (validReferences.length === 0 && evaluation.satisfaction !== 'none') {
      return {
        ...evaluation,
        evidenceReferences: [],
        satisfaction: 'none' as const,
        evidenceStrength: 'none' as const,
        uncertaintyReason: 'Evidence rejected by hallucination guard.',
      }
    }

    return {
      ...evaluation,
      evidenceReferences: validReferences,
    }
  })

  return {
    sanitizedMatrix: { evaluations: sanitizedEvaluations },
    rejectedCount,
  }
}
