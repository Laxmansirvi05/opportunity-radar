import { z } from 'zod'
import { Tables } from './database.types'

// ─── Base Table Types ───────────────────────────────────────────────
export type Opportunity = Tables<'opportunities'> & {
  // V2 intelligence fields (added by migration 002)
  extracted_skills: string[]
  skill_extraction_status: 'pending' | 'processed' | 'failed' | 'skipped'
  skill_extraction_version: string | null
}
export type Company = Tables<'companies'>
export type OpportunityTag = Tables<'opportunity_tags'>

// ─── Enriched Types (with JOINed data) ──────────────────────────────
export type OpportunityWithDetails = Opportunity & {
  companies: Pick<Company, 'id' | 'name' | 'logo_url'> | null
  opportunity_tags: Pick<OpportunityTag, 'tag_name'>[]
}

export type OpportunityWithCompany = Opportunity & {
  company: {
    id: string
    name: string
    logo_url: string | null
    website_url: string | null
    industry: string | null
  } | null
  opportunity_tags: { tag_name: string }[]
}

// ─── V2 Recommendation Types ────────────────────────────────────────
export interface RankedOpportunity extends Opportunity {
  match_score: number
  matched_skills: string[]
  missing_skills: string[]
  skill_coverage_pct: number
}

// ─── Search Filter Params (mirrors URL search params) ───────────────
export type SearchFilters = {
  q?: string
  category?: string[]
  mode?: string[]
  is_paid?: boolean
  experience_level?: string[]
  fresh?: string           // '1h' | '6h' | '24h' | '7d'
  deadline?: string        // '24h' | '1w' | '1m'
  location?: string
  tags?: string[]
  company?: string
  sort?: 'relevance' | 'newest' | 'deadline'
  page?: number
}

export const RecommendedOpportunitiesQuerySchema = z.object({
  category:          z.string().optional(),
  location:          z.string().optional(),
  experience_level:  z.string().optional(),
  limit:             z.coerce.number().int().min(1).max(100).default(50),
})
export type RecommendedOpportunitiesQuery = z.infer<typeof RecommendedOpportunitiesQuerySchema>

// ─── Constants ──────────────────────────────────────────────────────
export const OPPORTUNITY_CATEGORIES = [
  'Internship',
  'Job',
  'Hackathon',
  'Workshop',
  'Scholarship',
  'Competition',
] as const

export const OPPORTUNITY_MODES = ['Remote', 'Hybrid', 'Onsite'] as const

export const EXPERIENCE_LEVELS = ['Fresher', 'Undergrad', 'Masters', 'Any'] as const

export const FRESHNESS_OPTIONS = [
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
] as const

export const DEADLINE_OPTIONS = [
  { label: 'Next 24h', value: '24h' },
  { label: '1 week', value: '1w' },
  { label: '1 month', value: '1m' },
] as const

export const PAGE_SIZE = 20

// ─── Extraction status guard ─────────────────────────────────────────
export function isProcessed(opp: Opportunity): boolean {
  return opp.skill_extraction_status === 'processed'
}
