import { z } from 'zod'

// ---------------------------------------------------------------------------
// API Request
// ---------------------------------------------------------------------------
export const OptimizerRequestSchema = z.object({
  resume_id:       z.string().uuid(),
  opportunity_id:  z.string().uuid(),
  bullet_text:     z.string().min(10, 'Bullet must be at least 10 characters.').max(1000),
  bullet_location: z.object({
    section:          z.literal('experience'),
    experience_index: z.number().int().min(0),
    bullet_index:     z.number().int().min(0),
  }),
  target_skill: z.string().max(100).optional(),
})
export type OptimizerRequest = z.infer<typeof OptimizerRequestSchema>

// ---------------------------------------------------------------------------
// API Response
// ---------------------------------------------------------------------------
export interface OptimizerResponse {
  alternatives: string[]
  provider:     string
  latency_ms:   number
}

// ---------------------------------------------------------------------------
// Save version request
// ---------------------------------------------------------------------------
export const SaveVersionRequestSchema = z.object({
  base_resume_id: z.string().uuid(),
  opportunity_id: z.string().uuid().optional(),
  label:          z.string().max(100).optional(),
  changes:        z.array(
    z.object({
      section:          z.literal('experience'),
      experience_index: z.number().int().min(0),
      bullet_index:     z.number().int().min(0),
      original:         z.string(),
      optimized:        z.string(),
    })
  ).min(1).max(20),
})
export type SaveVersionRequest = z.infer<typeof SaveVersionRequestSchema>
