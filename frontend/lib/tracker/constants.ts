// Re-export all tracker types for convenience
export type {
  ApplicationStage,
  Application,
  ApplicationWithOpportunity,
  ApplicationEvent,
  AppEventType,
  KanbanBoard,
} from '@/types/tracker'

export {
  ApplicationStageSchema,
  STAGE_ORDER,
  emptyBoard,
} from '@/types/tracker'

// Stage display metadata
export const STAGE_META: Record<string, { label: string; color: string; emoji: string }> = {
  saved:     { label: 'Saved',       color: 'blue',   emoji: '📌' },
  applied:   { label: 'Applied',     color: 'amber',  emoji: '📤' },
  interview: { label: 'Interview',   color: 'purple', emoji: '🎯' },
  offer:     { label: 'Offer',       color: 'green',  emoji: '🎉' },
  rejected:  { label: 'Rejected',    color: 'red',    emoji: '❌' },
}

// Max applications per column before soft limit warning
export const COLUMN_SOFT_LIMIT = 50

// Max resume versions before oldest is auto-deleted
export const MAX_RESUME_VERSIONS = 10
