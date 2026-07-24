import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared / UI Schemas
// ---------------------------------------------------------------------------
export const atsSuggestionSchema = z.object({
  title: z.string().min(1).describe("Short title of the suggestion."),
  description: z.string().min(1).describe("Detailed actionable description. Must be labeled as a recommendation, not a fact."),
  impact: z.enum(["high", "medium", "low"]).describe("Expected impact level of this suggestion."),
});
export type AtsSuggestion = z.infer<typeof atsSuggestionSchema>;

export const atsSuggestedProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});
export type AtsSuggestedProject = z.infer<typeof atsSuggestedProjectSchema>;

// ---------------------------------------------------------------------------
// JD Extraction Schema (AI)
// ---------------------------------------------------------------------------
export const jdExtractionSchema = z.object({
  targetRole: z.string(),
  company: z.string().optional(),
  roleFamily: z.string().describe("e.g. Frontend, Backend, Data Science, Design, Sales"),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  keywords: z.array(z.string()),
  responsibilities: z.array(z.string()),
  minimumExperienceMonths: z.number().nullable(),
  educationRequirements: z.enum(['doctorate', 'masters', 'bachelors', 'diploma', 'other', 'none']),
  hardRequirements: z.array(z.object({
    rule: z.string(),
    type: z.enum(['Required', 'Eligibility'])
  })).describe("Explicit disqualifying rules from JD e.g. 'Must be graduating in 2027', 'Needs clearance'"),
});
export type JDExtraction = z.infer<typeof jdExtractionSchema>;

// ---------------------------------------------------------------------------
// Qualitative Coaching Schema (AI)
// ---------------------------------------------------------------------------
export const atsCoachingSchema = z.object({
  suggestions: z.array(atsSuggestionSchema).max(10),
  suggestedProjects: z.array(atsSuggestedProjectSchema).max(5),
  powerWords: z.array(z.string()).max(20),
  missingKeywordExplanations: z.array(z.object({
    keyword: z.string(),
    reason: z.string()
  }))
});
export type AtsCoaching = z.infer<typeof atsCoachingSchema>;

// ---------------------------------------------------------------------------
// ATS Readiness Result (Deterministic)
// ---------------------------------------------------------------------------
export const atsCategoryScoreSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  evidence: z.array(z.string()),
  deductions: z.array(z.string()),
});
export type AtsCategoryScore = z.infer<typeof atsCategoryScoreSchema>;

export const atsReadinessResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  categories: z.object({
    coreSections: atsCategoryScoreSchema, // 20
    parsability: atsCategoryScoreSchema,  // 15
    contentQuality: atsCategoryScoreSchema, // 20
    impact: atsCategoryScoreSchema,       // 15
    skills: atsCategoryScoreSchema,       // 15
    professionalQuality: atsCategoryScoreSchema, // 15
  }),
});
export type AtsReadinessResult = z.infer<typeof atsReadinessResultSchema>;

// ---------------------------------------------------------------------------
// Job Match Result (Deterministic V3)
// ---------------------------------------------------------------------------
export const jobMatchResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  categories: z.object({
    requiredSkills: atsCategoryScoreSchema, // 30
    roleAlignment: atsCategoryScoreSchema, // 20
    experienceRelevance: atsCategoryScoreSchema, // 15
    projectEvidence: atsCategoryScoreSchema, // 15
    keywordCoverage: atsCategoryScoreSchema, // 10
    educationAlignment: atsCategoryScoreSchema, // 5
    atsStructure: atsCategoryScoreSchema, // 5
  }),
  evidencedSkills: z.array(z.string()),
  listedSkills: z.array(z.string()),
  missingRequiredSkills: z.array(z.string()),
  missingPreferredSkills: z.array(z.string()),
  hardRequirements: z.array(z.object({
    rule: z.string(),
    status: z.enum(['Met', 'Not Met', 'Unknown'])
  })),
});
export type JobMatchResult = z.infer<typeof jobMatchResultSchema>;

// ---------------------------------------------------------------------------
// Full Output for UI
// ---------------------------------------------------------------------------
export const atsCheckResponseSchema = z.object({
  readiness: atsReadinessResultSchema,
  jobMatch: jobMatchResultSchema.optional(), // Only present if JD is provided
  coaching: atsCoachingSchema.optional(), // Qualitative feedback (always present unless AI fails)
  aiFailed: z.boolean().default(false), // True if AI failed but deterministic ran
});
export type AtsCheckResponse = z.infer<typeof atsCheckResponseSchema>;
