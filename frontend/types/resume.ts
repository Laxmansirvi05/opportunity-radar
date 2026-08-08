import { z } from 'zod'

// ---------------------------------------------------------------------------
// Resume Status
// ---------------------------------------------------------------------------
export const ResumeStatusSchema = z.enum([
  'uploaded',
  'parsing',
  'review_required',
  'verified',
  'failed',
])
export type ResumeStatus = z.infer<typeof ResumeStatusSchema>

// ---------------------------------------------------------------------------
// Parsed Resume Sub-schemas
// ---------------------------------------------------------------------------
export const ResumeExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  start_date: z.string(),           // ISO date string or 'Present'
  end_date: z.string().optional(),  // undefined means current
  location: z.string().optional(),
  bullets: z.array(z.string()),
})
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>

export const ResumeProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  technologies: z.array(z.string()),
  url: z.string().url().optional(),
})
export type ResumeProject = z.infer<typeof ResumeProjectSchema>

export const ResumeEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  // Rank order for education comparison: doctorate > masters > bachelors > diploma > other
  degree_level: z.enum(['doctorate', 'masters', 'bachelors', 'diploma', 'other']),
  field: z.string().optional(),
  graduation_year: z.number().int().min(1990).max(2040).optional(),
  gpa: z.number().min(0).max(10).optional(),
})
export type ResumeEducation = z.infer<typeof ResumeEducationSchema>

// ---------------------------------------------------------------------------
// Full Parsed Resume
// ---------------------------------------------------------------------------
export const ParsedResumeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  education: z.array(ResumeEducationSchema).default([]),
  rawText: z.string().optional(),
})
export type ParsedResume = z.infer<typeof ParsedResumeSchema>

// ---------------------------------------------------------------------------
// Resume DB Row
// ---------------------------------------------------------------------------
export interface Resume {
  id: string
  user_id: string
  file_url: string
  file_name: string | null
  parsed_data: ParsedResume | Record<string, unknown>
  extracted_skills: string[]
  extracted_project_keywords: string[]
  status: ResumeStatus
  error_message: string | null
  is_master: boolean
  resume_updated_at: string
  resume_last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Resume Version
// ---------------------------------------------------------------------------
export interface BulletChange {
  section: 'experience'
  experience_index: number
  bullet_index: number
  original: string
  optimized: string
}

export interface ResumeVersion {
  id: string
  user_id: string
  base_resume_id: string
  opportunity_id: string | null
  label: string | null
  parsed_data: ParsedResume
  changes: BulletChange[]
  created_at: string
}

// ---------------------------------------------------------------------------
// Upload validation
// ---------------------------------------------------------------------------
export const ResumeUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.type === 'application/pdf', 'Only PDF files are accepted.')
    .refine((f) => f.size <= 5 * 1024 * 1024, 'File size must be under 5MB.'),
})

// ---------------------------------------------------------------------------
// Utility: extract denormalised skill arrays from ParsedResume
// ---------------------------------------------------------------------------
export function extractResumeSkills(parsed: ParsedResume): {
  skills: string[]
  projectKeywords: string[]
} {
  const skills = [
    ...new Set(parsed.skills.map((s) => s.toLowerCase().trim()).filter(Boolean)),
  ].sort()

  const projectKeywords = [
    ...new Set(
      parsed.projects
        .flatMap((p) => p.technologies)
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 1 && !skills.includes(t))
    ),
  ].sort()

  return { skills, projectKeywords }
}
