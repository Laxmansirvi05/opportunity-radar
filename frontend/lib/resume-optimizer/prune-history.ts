/**
 * Keeps at most `keep` rows per user in a history table, deleting the
 * oldest beyond that — called right after a successful insert into either
 * `resume_ats_reports` or `resume_optimizations` so history never grows
 * unbounded. Best-effort: a failure here does not fail the request that
 * just saved a real result, it only means one extra row lingers until the
 * next save.
 */
export async function pruneHistoryTable(
  supabase: any,
  table: 'resume_ats_reports' | 'resume_optimizations',
  userId: string,
  keep = 6
): Promise<void> {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !rows || rows.length <= keep) return

  const staleIds = rows.slice(keep).map((r: { id: string }) => r.id)
  if (staleIds.length === 0) return

  const { error: deleteError } = await supabase.from(table).delete().in('id', staleIds)
  if (deleteError) {
    console.error(`[history] failed to prune ${table}`, deleteError)
  }
}
