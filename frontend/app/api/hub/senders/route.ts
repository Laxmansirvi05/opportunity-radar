import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/hub/senders?ids=uuid1,uuid2,...
 *
 * Resolves the public-facing profile fields (name, avatar, email, LinkedIn)
 * for a batch of user ids. `profiles` SELECT RLS is `auth.uid() = id`, so
 * the browser's own Supabase client can only ever read the viewer's own
 * row — it can never resolve who sent someone else's message. This route
 * exists so client code (the realtime subscription, specifically) has a
 * safe, authenticated way to resolve OTHER members' public info without
 * ever holding the service-role key itself.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 100)
  if (ids.length === 0) {
    return NextResponse.json({ senders: {} })
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminSupabase
    .from('profiles')
    .select('id, name, avatar_url, email, linkedin_url')
    .in('id', ids)

  if (error) {
    console.error('[Hub] Failed to resolve senders:', error)
    return NextResponse.json({ error: 'Failed to resolve senders' }, { status: 500 })
  }

  const senders: Record<string, { name: string | null; avatar_url: string | null; email: string | null; linkedin_url: string | null }> = {}
  for (const p of data ?? []) {
    senders[p.id] = { name: p.name, avatar_url: p.avatar_url, email: p.email, linkedin_url: p.linkedin_url }
  }

  return NextResponse.json({ senders })
}
