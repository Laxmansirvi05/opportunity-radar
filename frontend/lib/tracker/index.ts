export { STAGE_ORDER } from '@/types/tracker'
export type { ApplicationStage, Application, KanbanBoard, ApplicationWithOpportunity } from '@/types/tracker'

import type { Application, ApplicationWithOpportunity, KanbanBoard } from '@/types/tracker'
import { emptyBoard } from '@/types/tracker'

// ---------------------------------------------------------------------------
// Build a Kanban board from a flat list of applications
// ---------------------------------------------------------------------------
export function buildKanbanBoard(
  applications: ApplicationWithOpportunity[]
): KanbanBoard {
  const board = emptyBoard()

  for (const app of applications) {
    if (app.stage in board) {
      board[app.stage].push(app)
    }
  }

  // Sort each column by column_position ascending
  for (const stage of Object.keys(board) as Array<keyof KanbanBoard>) {
    board[stage].sort((a, b) => a.column_position - b.column_position)
  }

  return board
}

// ---------------------------------------------------------------------------
// Compute the next gap-strategy position for a column
// Gap strategy: positions in multiples of 100
// Insert between two cards: midpoint. Re-normalise if gap < 1.
// ---------------------------------------------------------------------------
export function computeInsertPosition(
  above: Application | null,
  below: Application | null
): number {
  if (!above && !below) return 100
  if (!above) return Math.max((below!.column_position) - 100, 0)
  if (!below) return above.column_position + 100

  const mid = Math.floor((above.column_position + below.column_position) / 2)
  // If the gap is too small, re-normalisation is triggered server-side
  return mid
}

// ---------------------------------------------------------------------------
// Check if re-normalisation is needed (gap < 1 between adjacent cards)
// ---------------------------------------------------------------------------
export function needsReNormalisation(column: Application[]): boolean {
  const sorted = [...column].sort((a: Application, b: Application) => a.column_position - b.column_position)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].column_position - sorted[i - 1].column_position < 1) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Generate re-normalised positions (multiples of 100)
// ---------------------------------------------------------------------------
export function reNormalisePositions(
  column: Application[]
): Array<{ id: string; position: number }> {
  return column
    .sort((a, b) => a.column_position - b.column_position)
    .map((app, idx) => ({ id: app.id, position: (idx + 1) * 100 }))
}
