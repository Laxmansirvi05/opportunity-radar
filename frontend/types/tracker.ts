import { z } from 'zod'

// ---------------------------------------------------------------------------
// Application Stage
// ---------------------------------------------------------------------------
export const ApplicationStageSchema = z.enum([
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
])
export type ApplicationStage = z.infer<typeof ApplicationStageSchema>

export const STAGE_ORDER: ApplicationStage[] = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
]

// ---------------------------------------------------------------------------
// Application DB Row
// ---------------------------------------------------------------------------
export interface Application {
  id: string
  user_id: string
  opportunity_id: string
  stage: ApplicationStage
  ats_score_snapshot: number | null
  match_score_snapshot: number | null
  resume_version_id: string | null
  applied_at: string | null
  notes: string | null
  custom_label: string | null
  column_position: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Application with Opportunity joined
// ---------------------------------------------------------------------------
export interface ApplicationWithOpportunity extends Application {
  opportunity_title: string
  opportunity_company: string | null
  opportunity_location: string | null
  opportunity_is_paid: boolean | null
  opportunity_deadline: string | null
  opportunity_apply_url: string
}

// ---------------------------------------------------------------------------
// Application Event (Timeline)
// ---------------------------------------------------------------------------
export const AppEventTypeSchema = z.enum([
  'stage_change',
  'note_added',
  'note_edited',
  'score_snapshot',
])
export type AppEventType = z.infer<typeof AppEventTypeSchema>

export interface ApplicationEvent {
  id: string
  application_id: string
  user_id: string
  event_type: AppEventType
  payload: Record<string, unknown>
  created_at: string
}

// ---------------------------------------------------------------------------
// Kanban Board (client-side state)
// ---------------------------------------------------------------------------
export type KanbanBoard = Record<ApplicationStage, ApplicationWithOpportunity[]>

export function emptyBoard(): KanbanBoard {
  return {
    saved:     [],
    applied:   [],
    interview: [],
    offer:     [],
    rejected:  [],
    archived:  [],
  }
}

// ---------------------------------------------------------------------------
// API Input Schemas
// ---------------------------------------------------------------------------
export const SaveApplicationSchema = z.object({
  opportunity_id: z.string().uuid(),
})

export const StageUpdateSchema = z.object({
  stage:           ApplicationStageSchema,
  column_position: z.number().int().min(0).optional(),
})

export const NotesUpdateSchema = z.object({
  notes: z.string().max(5000),
})
