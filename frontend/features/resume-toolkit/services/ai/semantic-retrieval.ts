import type { JDRequirement, EvidenceReference } from '../lib/schema/resume/ats-v2'

export function filterCandidateEvidence(
  requirement: JDRequirement,
  allEvidence: EvidenceReference[]
): EvidenceReference[] {
  const reqNameLower = requirement.name.toLowerCase()
  const reqWords = reqNameLower.split(/\s+/).filter((w) => w.length > 2)

  return allEvidence.filter((ref) => {
    const textLower = ref.exactText.toLowerCase()
    const contextLower = (ref.context || '').toLowerCase()
    const techLower = (ref.technologiesDemonstrated || []).map((t) => t.toLowerCase())

    // Direct match in text or tech list
    if (textLower.includes(reqNameLower) || techLower.includes(reqNameLower)) {
      return true
    }

    // Word match ratio
    if (reqWords.length > 0) {
      const matchCount = reqWords.filter(
        (word) => textLower.includes(word) || contextLower.includes(word) || techLower.some((t) => t.includes(word))
      ).length
      if (matchCount / reqWords.length >= 0.5) {
        return true
      }
    }

    return false
  })
}
