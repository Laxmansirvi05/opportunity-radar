import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

export interface LandingStats {
  opportunities: number
  companies: number
}

/**
 * Round a live count down to a figure that is safe to print with a "+".
 *
 * Rounding down means the claim is always true: 2,996 reads "2,900+", never
 * "3,000+". Below 100 the exact number is shown with no "+".
 */
export function formatStat(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n < 100) return String(Math.floor(n))
  const step = n < 1000 ? 50 : 100
  return `${(Math.floor(n / step) * step).toLocaleString('en-US')}+`
}

async function fetchLandingStats(): Promise<LandingStats> {
  // Plain anon client, not the cookie-bound one: the numbers are public and
  // depending on cookies would stop the landing page being cached.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase.rpc('landing_stats')
  // Throw so unstable_cache does not remember a failure as "0 opportunities".
  if (error || !data) throw new Error(`landing_stats failed: ${error?.message ?? 'no data'}`)
  const row = data as { opportunities: number; companies: number }
  return { opportunities: Number(row.opportunities), companies: Number(row.companies) }
}

const cachedLandingStats = unstable_cache(fetchLandingStats, ['landing-stats-v1'], { revalidate: 3600 })

/**
 * Catalogue size for the landing hero, or null when it cannot be read.
 * The page omits the two figures on null rather than printing a guess.
 */
export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    return await cachedLandingStats()
  } catch (err) {
    console.error('[Landing] stats unavailable:', err instanceof Error ? err.message : String(err))
    return null
  }
}
