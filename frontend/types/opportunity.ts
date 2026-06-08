import { Tables } from './database.types'

// ─── Base Table Types ───────────────────────────────────────────────
export type Opportunity = Tables<'opportunities'>
export type Company = Tables<'companies'>
export type OpportunityTag = Tables<'opportunity_tags'>

// ─── Enriched Types (with JOINed data) ──────────────────────────────
export type OpportunityWithDetails = Opportunity & {
  companies: Pick<Company, 'id' | 'name' | 'logo_url'> | null
  opportunity_tags: Pick<OpportunityTag, 'tag_name'>[]
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
