// Re-export tracker types from the canonical types/tracker.ts
// This file exists for consumers who prefer importing from lib/tracker
export type {
  ApplicationStage,
  Application,
  ApplicationWithOpportunity,
  ApplicationEvent,
  AppEventType,
  KanbanBoard,
} from '@/types/tracker'

export { ApplicationStageSchema, STAGE_ORDER, emptyBoard } from '@/types/tracker'
