import { z } from "zod";
import { importanceEnum, structuredJDSchema, evidenceMatrixSchema } from "./ats-v2";

// ---------------------------------------------------------------------------
// Qualitative Coaching Schema (AI) — narration only, never a second score.
// The score, matched/missing requirements and the checklist are already
// final by the time this runs; this schema exists only for a human-voiced
// verdict and generic power words, nothing that could compete with or
// contradict the deterministic engine's output.
// ---------------------------------------------------------------------------
export const atsCoachingSchema = z.object({
  recruiterVerdict: z.string().min(1).describe("A concise 2-4 sentence HR/Recruiter assessment of the candidate's fit for the role, grounded in the already-computed evidence evaluation."),
  powerWords: z.array(z.string()).max(20),
});
export type AtsCoaching = z.infer<typeof atsCoachingSchema>;

// ---------------------------------------------------------------------------
// ATS Readiness Result (Deterministic, JD-independent — used for resume_only
// mode, and as supplementary context alongside a targeted analysis).
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
// V2 Scoring Schemas (Deterministic — the one and only scoring engine for
// targeted mode; AI supplies structured extraction and evidence judgments,
// this is what turns those into the actual 0-100 number.)
// ---------------------------------------------------------------------------
export const requirementScoreSchema = z.object({
  requirementId: z.string(),
  requirementName: z.string(),
  category: z.string(),
  importance: importanceEnum,
  weight: z.number(),
  satisfactionFactor: z.number(),
  evidenceStrengthFactor: z.number(),
  evidenceTypeBonus: z.number(),
  quantifiedImpactBonus: z.number(),
  rawScore: z.number(),
  cappedScore: z.number(),
  weightedScore: z.number(),
  maxWeightedScore: z.number(),
  satisfaction: z.string(),
  evidenceStrength: z.string(),
  bestEvidenceType: z.string().nullable(),
  hasQuantifiedImpact: z.boolean(),
  gapReason: z.string().nullable().optional(),
  semanticReasoning: z.string(),
});

export const resumeQualityScoreSchema = z.object({
  total: z.number(),
  hasSummary: z.boolean(),
  hasExperience: z.boolean(),
  hasEducation: z.boolean(),
  hasSkills: z.boolean(),
  hasProjects: z.boolean(),
  hasQuantifiedBullets: z.boolean(),
  hasContactInfo: z.boolean(),
});

export const hardRequirementResultSchema = z.object({
  passed: z.boolean(),
  cap: z.number().nullable(),
  failedRequirements: z.array(z.string()),
  reason: z.string().optional(),
});

export const scoreConfidenceSchema = z.object({
  confidenceLevel: z.enum(['full', 'high', 'moderate', 'low']),
  evaluationCoverage: z.number(),
  retrievalDegraded: z.boolean(),
  meanAIConfidence: z.number(),
  unevaluatedRequirements: z.array(z.string()),
});

export const atsV2ScoreSchema = z.object({
  overallScore: z.number(),
  capabilityScore: z.number(),
  qualityScore: z.number(),
  band: z.enum(['exceptional', 'strong', 'moderate', 'partial', 'weak', 'poor']),
  requirements: z.array(requirementScoreSchema),
  quality: resumeQualityScoreSchema,
  hardRequirements: hardRequirementResultSchema,
  confidence: scoreConfidenceSchema,
  scoreCappedReason: z.string().optional(),
});

export type RequirementScore = z.infer<typeof requirementScoreSchema>;
export type ResumeQualityScore = z.infer<typeof resumeQualityScoreSchema>;
export type HardRequirementResult = z.infer<typeof hardRequirementResultSchema>;
export type ScoreConfidence = z.infer<typeof scoreConfidenceSchema>;
export type AtsV2Score = z.infer<typeof atsV2ScoreSchema>;

// ---------------------------------------------------------------------------
// Gap checklist (deterministic — see lib/ats-checker/gap-suggestions.ts).
// Shared shape between the ATS Checker and the Optimiser so they never
// present two different sets of gaps for the same analysis.
// ---------------------------------------------------------------------------
export const gapSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(['project', 'course', 'skill', 'certification', 'education']),
  title: z.string(),
  detail: z.string(),
  requirement: z.string(),
  importance: importanceEnum,
  completed: z.boolean(),
  completed_at: z.string().nullable().optional(),
  guidance: z.string().optional(),
});
export type GapSuggestion = z.infer<typeof gapSuggestionSchema>;

// ---------------------------------------------------------------------------
// Academic recommendation (deterministic, mode-agnostic — see
// lib/ats-checker/academic-recommendation.ts).
// ---------------------------------------------------------------------------
export const academicRecommendationSchema = z.object({
  visible: z.boolean(),
  message: z.string(),
  observed: z.string(),
  rule: z.string(),
});
export type AcademicRecommendationResult = z.infer<typeof academicRecommendationSchema>;

// ---------------------------------------------------------------------------
// Analysis error — the REAL reason a targeted analysis could not be
// completed, surfaced to the UI instead of one hardcoded generic message
// regardless of which stage actually failed.
// ---------------------------------------------------------------------------
export const analysisErrorSchema = z.object({
  stage: z.enum(['jd_extraction', 'evidence_evaluation', 'unexpected']),
  message: z.string(),
});
export type AnalysisError = z.infer<typeof analysisErrorSchema>;

// ---------------------------------------------------------------------------
// Full Output for UI — ONE canonical result. `mode` says which kind of
// analysis this is; everything the UI renders is read from this object,
// never independently recomputed by a component or a second engine.
// ---------------------------------------------------------------------------
export const atsCheckResponseSchema = z.object({
  mode: z.enum(['resume_only', 'targeted']),
  readiness: atsReadinessResultSchema,
  atsV2: z.object({
    score: atsV2ScoreSchema,
    evidenceMatrix: evidenceMatrixSchema,
    structuredJd: structuredJDSchema,
  }).optional(), // present only when mode === 'targeted' and analysis succeeded
  coaching: atsCoachingSchema.optional(),
  suggestions: z.array(gapSuggestionSchema).default([]),
  academicRecommendation: academicRecommendationSchema.nullable().default(null),
  analysisError: analysisErrorSchema.nullable().default(null),
  /** Derived from analysisError !== null; kept as its own field for simpler UI/test checks. */
  aiFailed: z.boolean().default(false),
});
export type AtsCheckResponse = z.infer<typeof atsCheckResponseSchema>;
