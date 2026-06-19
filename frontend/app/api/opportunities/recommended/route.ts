import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { RecommendedOpportunitiesQuerySchema } from '@/types/opportunity'

// ---------------------------------------------------------------------------
// GET /api/opportunities/recommended
// Returns personalised ranked opportunity feed for the authenticated student
// Query params: category, location, experience_level, limit (default 50)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse + validate query params
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const query = RecommendedOpportunitiesQuerySchema.safeParse(params)

  if (!query.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters.', details: query.error.issues },
      { status: 422 }
    )
  }

  // Call the get_ranked_opportunities RPC
  const { data, error } = await supabase.rpc('get_ranked_opportunities', {
    p_user_id:          user.id,
    p_category:         query.data.category         ?? null,
    p_location:         query.data.location         ?? null,
    p_experience_level: query.data.experience_level ?? null,
    p_limit:            query.data.limit,
  })

  if (error) {
    console.error('[Recommended] RPC error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch recommendations.' }, { status: 500 })
  }

  return NextResponse.json({
    opportunities: data ?? [],
    count:         data?.length ?? 0,
  }, {
    headers: {
      // Cache for 60 seconds at CDN level for non-personalised segments
      'Cache-Control': 'private, max-age=60',
    }
  })
}
