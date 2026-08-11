import type { SupabaseClient } from '@supabase/supabase-js'
import type { CertificationRecord } from './ingest'

/**
 * Writes a batch of certification records, upserting on the table's
 * `(source, source_id)` unique constraint so a re-run refreshes existing rows
 * (last_seen_at, price, description) instead of duplicating them.
 *
 * Certifications never expire on a schedule (see the migration's comment),
 * so unlike opportunities there is no reconciliation/deletion step here — a
 * course that stops showing up in one run simply isn't refreshed until the
 * next one, rather than being removed.
 */
export async function upsertCertifications(
  supabase: SupabaseClient,
  records: CertificationRecord[],
  batchSize = 250
): Promise<{ upserted: number; errors: number }> {
  let upserted = 0
  let errors = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error, count } = await supabase
      .from('certifications')
      .upsert(batch, { onConflict: 'source,source_id', count: 'exact' })

    if (error) {
      console.error('[Certifications] batch upsert failed:', error.message)
      errors += batch.length
    } else {
      upserted += count ?? batch.length
    }
  }

  return { upserted, errors }
}
