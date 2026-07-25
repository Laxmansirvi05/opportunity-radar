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
      if (skill) snippets.push(skill.toLowerCase())
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
  const allSnippets = extractAllResumeTextSnippets(resume)

  // Direct inclusion match in any snippet
  const directMatch = allSnippets.some(
    (snippet) => snippet.includes(exactLower) || exactLower.includes(snippet)
  )

  if (directMatch) {
    return { isValid: true }
  }

  // Token overlap check
  const words = exactLower.split(/\s+/).filter((w: string) => w.length > 2)
  if (words.length === 0) {
    return { isValid: false, reason: 'Exact text contains no meaningful words' }
  }

  const matchesAnySnippet = allSnippets.some((snippet) => {
    const matchCount = words.filter((w: string) => snippet.includes(w)).length
    return matchCount / words.length >= 0.6
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
    const validReferences = (evaluation.evidenceReferences || []).filter((ref: EvidenceReference) => {
      const v = verifyEvidence(resume, ref)
      if (!v.isValid) {
        rejectedCount++
        return false
      }
      return true
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
