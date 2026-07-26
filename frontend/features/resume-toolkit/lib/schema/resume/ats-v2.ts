import { z } from 'zod'

export const capabilityCategoryEnum = z.enum([
  'hard_requirement',
  'technical_capability',
  'responsibility',
  'experience_level',
  'education',
  'certification',
  'domain_knowledge',
  'tooling_environment',
  'soft_skill',
  'location_auth',
  'preferred_qualification',
  'other'
])

export const importanceEnum = z.enum([
  'critical',
  'high',
  'medium',
  'low'
])

export const requirementProvenanceSchema = z.object({
  exactQuote: z.string().nullable().optional().describe('The exact text from the JD that justifies this requirement.'),
  context: z.string().nullable().optional().describe('Surrounding context or section name where this was found.')
})

export const jdRequirementSchema = z.object({
  id: z.string().describe('A unique stable slug for this requirement (e.g., skill_react, exp_5_years).'),
  name: z.string().describe('The standardized name of the requirement (e.g., "React.js", "5+ Years Experience").'),
  category: capabilityCategoryEnum,
  importance: importanceEnum,
  description: z.string().nullable().optional().describe('A brief explanation of what is required based on the JD.'),
  provenance: requirementProvenanceSchema
})

export const structuredJDSchema = z.object({
  roleTitle: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  roleFamily: z.string().nullable().optional().describe('Broad category e.g., "Software Engineering", "Data", "Design"'),
  seniority: z.string().nullable().optional().describe('e.g., "Intern", "Junior", "Senior", "Staff"'),
  requirements: z.array(jdRequirementSchema)
})

export type JDRequirement = z.infer<typeof jdRequirementSchema>
export type StructuredJD = z.infer<typeof structuredJDSchema>
export type CapabilityCategory = z.infer<typeof capabilityCategoryEnum>
export type ImportanceLevel = z.infer<typeof importanceEnum>

// --- PHASE 2 SCHEMAS: EVIDENCE & EVALUATION ---

export const evidenceTypeEnum = z.enum([
  'learning',
  'listed_skill',
  'coursework',
  'certification',
  'education',
  'project',
  'professional_experience',
  'achievement',
  'leadership'
])

export const evidenceReferenceSchema = z.object({
  evidenceId: z.string().describe('Unique ID for this evidence reference'),
  sourceSection: z.string().describe('The section of the resume where this was found (e.g., "experience", "skills")'),
  exactText: z.string().describe('The EXACT text snippet from the resume.'),
  evidenceType: evidenceTypeEnum,
  context: z.string().nullable().optional().describe('Context or surrounding information.'),
  technologiesDemonstrated: z.array(z.string()).nullable().optional(),
  quantifiedImpact: z.string().nullable().optional().describe('Any metrics or measurable impact found in the evidence.'),
  recency: z.string().nullable().optional().describe('When did this occur, if stated.'),
  confidence: z.number().min(0).max(1).describe('AI confidence (0 to 1) that this evidence is real and applies.')
})

export const requirementSatisfactionEnum = z.enum([
  'none',
  'insufficient',
  'partial',
  'substantial',
  'complete'
])

export const evidenceStrengthEnum = z.enum([
  'none',
  'weak',
  'moderate',
  'strong',
  'exceptional'
])

export const requirementEvaluationSchema = z.object({
  capabilityId: z.string().describe('Must match the id of the JDRequirement being evaluated.'),
  satisfaction: requirementSatisfactionEnum,
  evidenceStrength: evidenceStrengthEnum,
  evidenceReferences: z.array(evidenceReferenceSchema),
  confidence: z.number().min(0).max(1),
  semanticReasoning: z.string().describe('Why this evidence strength and satisfaction level was chosen.'),
  gapReason: z.string().nullable().optional().describe('If satisfaction is not complete, explain exactly what is missing.'),
  uncertaintyReason: z.string().nullable().optional().describe('If insufficient evidence, explain why the AI cannot be certain.')
})

export const evidenceMatrixSchema = z.object({
  evaluations: z.array(requirementEvaluationSchema)
})

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>
export type RequirementEvaluation = z.infer<typeof requirementEvaluationSchema>
export type EvidenceMatrix = z.infer<typeof evidenceMatrixSchema>

