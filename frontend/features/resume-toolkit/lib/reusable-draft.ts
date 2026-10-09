export const UNTITLED_RESUME = 'Untitled Resume'

export interface DraftRow {
  id: string
  file_name: string | null
  created_at: string
  updated_at: string | null
}

/**
 * The newest blank resume the user has never edited, if there is one.
 *
 * /resume/builder used to create a resume on every request. It is a GET, so
 * a refresh, the back button, or Next.js prefetching the link from the
 * Resume page each added another "Untitled Resume". An untouched draft is
 * one still carrying the default name whose updated_at has not moved from
 * its created_at (allowing a second for the insert trigger).
 */
export function pickReusableDraft(rows: DraftRow[]): string | null {
  const untouched = rows
    .filter((row) => row.file_name === UNTITLED_RESUME)
    .filter((row) => {
      if (!row.updated_at) return true
      const drift = Math.abs(new Date(row.updated_at).getTime() - new Date(row.created_at).getTime())
      return Number.isFinite(drift) && drift <= 1000
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return untouched[0]?.id ?? null
}
