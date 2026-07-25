import type { ParsedResume } from '@/types/resume'
import type { EvidenceReference } from '../../lib/schema/resume/ats-v2'

export function extractEvidenceUnits(resume: ParsedResume): EvidenceReference[] {
  const units: EvidenceReference[] = []
  let idCounter = 1

  // 1. Experience
  if (resume.experience && Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      const company = exp.company || ''
      const role = exp.role || ''
      const title = role ? `${role} at ${company}` : company
      const bullets = (exp as any).bullets || (exp as any).highlights || []

      if (Array.isArray(bullets)) {
        for (const highlight of bullets) {
          if (!highlight || !highlight.trim()) continue

          // Detect metric / quantified impact
          const hasMetric = /\b\d+(?:%|\+|k|M|B|x|\s?percent|\s?dollars|\s?hrs|\s?hours)?\b/i.test(highlight)

          units.push({
            evidenceId: `exp_${idCounter++}`,
            sourceSection: 'experience',
            exactText: highlight.trim(),
            evidenceType: 'professional_experience',
            context: title,
            technologiesDemonstrated: [],
            quantifiedImpact: hasMetric ? highlight.trim() : null,
            recency: (exp as any).start_date || (exp as any).startDate || null,
            confidence: 0.95,
          })
        }
      }
    }
  }

  // 2. Projects
  if (resume.projects && Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      const projName = proj.name || 'Project'
      const description = proj.description || ''

      if (description.trim()) {
        const hasMetric = /\b\d+(?:%|\+|k|M|B|x|\s?percent)?\b/i.test(description)

        units.push({
          evidenceId: `proj_${idCounter++}`,
          sourceSection: 'projects',
          exactText: description.trim(),
          evidenceType: 'project',
          context: projName,
          technologiesDemonstrated: proj.technologies || [],
          quantifiedImpact: hasMetric ? description.trim() : null,
          recency: null,
          confidence: 0.9,
        })
      }

      const projHighlights = (proj as any).highlights || []
      if (Array.isArray(projHighlights)) {
        for (const highlight of projHighlights) {
          if (!highlight || !highlight.trim()) continue
          const hasMetric = /\b\d+(?:%|\+|k|M|B|x|\s?percent)?\b/i.test(highlight)

          units.push({
            evidenceId: `proj_${idCounter++}`,
            sourceSection: 'projects',
            exactText: highlight.trim(),
            evidenceType: 'project',
            context: projName,
            technologiesDemonstrated: proj.technologies || [],
            quantifiedImpact: hasMetric ? highlight.trim() : null,
            recency: null,
            confidence: 0.9,
          })
        }
      }
    }
  }

  // 3. Skills
  if (resume.skills && Array.isArray(resume.skills)) {
    for (const skill of resume.skills) {
      if (!skill || !skill.trim()) continue
      units.push({
        evidenceId: `skill_${idCounter++}`,
        sourceSection: 'skills',
        exactText: skill.trim(),
        evidenceType: 'listed_skill',
        context: 'Listed Skills',
        technologiesDemonstrated: [skill.trim()],
        quantifiedImpact: null,
        recency: null,
        confidence: 0.8,
      })
    }
  }

  // 4. Education
  if (resume.education && Array.isArray(resume.education)) {
    for (const edu of resume.education) {
      const degree = edu.degree || ''
      const field = edu.field || ''
      const institution = edu.institution || ''
      const text = [degree, field, institution].filter(Boolean).join(' in ')

      if (text.trim()) {
        units.push({
          evidenceId: `edu_${idCounter++}`,
          sourceSection: 'education',
          exactText: text.trim(),
          evidenceType: 'education',
          context: institution,
          technologiesDemonstrated: [],
          quantifiedImpact: null,
          recency: (edu as any).end_date || (edu as any).endDate || (edu as any).graduation_year?.toString() || null,
          confidence: 1.0,
        })
      }
    }
  }

  // 5. Summary
  if (resume.summary && resume.summary.trim()) {
    units.push({
      evidenceId: `summary_${idCounter++}`,
      sourceSection: 'summary',
      exactText: resume.summary.trim(),
      evidenceType: 'learning',
      context: 'Professional Summary',
      technologiesDemonstrated: [],
      quantifiedImpact: null,
      recency: null,
      confidence: 0.7,
    })
  }

  return units
}
