import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const PAGE_SIZE = 50

/**
 * GET /api/hub/messages
 *
 * Returns the most recent PAGE_SIZE Hub messages, oldest-first for display.
 *
 * Pagination uses a compound cursor (before_created_at + before_id) so that
 * messages with identical timestamps cannot be skipped or duplicated.
 *
 * Query params:
 *   before_created_at  — ISO timestamp of the oldest loaded message
 *   before_id          — UUID of the oldest loaded message (tie-breaker)
 *
 * Response shape:
 *   { messages: HubMessageRow[], hasMore: boolean }
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client to bypass RLS when reading public profile information
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const beforeCreatedAt = searchParams.get('before_created_at')
  const beforeId = searchParams.get('before_id')

  // Fetch messages descending, then reverse — so we get the latest N messages
  // displayed chronologically in the UI without fetching from the beginning.
  let query = supabase
    .from('hub_messages')
    .select('id, sender_id, content, reply_to_id, created_at, image_url, image_width, image_height, edited_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1) // fetch one extra to determine hasMore

  // Compound cursor: page goes further back in time
  if (beforeCreatedAt && beforeId) {
    // Messages strictly before the cursor timestamp, OR same timestamp but earlier ID
    query = query.or(
      `created_at.lt.${beforeCreatedAt},and(created_at.eq.${beforeCreatedAt},id.lt.${beforeId})`
    )
  }

  const { data: rawMessages, error: messagesError } = await query

  if (messagesError) {
    console.error('[Hub] Failed to fetch messages:', {
      message: messagesError?.message,
      code: messagesError?.code,
      details: messagesError?.details,
      hint: messagesError?.hint
    })
    return NextResponse.json({ 
      error: 'Failed to load messages',
      details: process.env.NODE_ENV === 'development' ? messagesError : undefined
    }, { status: 500 })
  }

  const hasMore = (rawMessages?.length ?? 0) > PAGE_SIZE
  const messages = (rawMessages ?? []).slice(0, PAGE_SIZE)

  // ── Resolve sender profiles ─────────────────────────────────────────────────
  // Collect unique sender IDs and fetch their public profile fields in one query.
  // We do NOT use a nested Supabase join because the profiles.id → auth.users.id
  // relationship is not exposed as a PostgREST foreign-key hint on older project
  // configurations. A single IN query is just as efficient and always reliable.
  const senderIds = [...new Set(messages.map(m => m.sender_id))]

  const profiles: Record<string, { name: string | null; avatar_url: string | null; email: string | null; linkedin_url: string | null }> = {}

  if (senderIds.length > 0) {
    const { data: profileRows, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, name, avatar_url, email, linkedin_url')
      .in('id', senderIds)

    if (profileError) {
      // Non-fatal: messages still render with fallback identity
      console.error('[Hub] Failed to fetch sender profiles:', profileError)
    } else {
      for (const p of profileRows ?? []) {
        profiles[p.id] = { name: p.name, avatar_url: p.avatar_url, email: p.email, linkedin_url: p.linkedin_url }
      }
    }
  }

  // ── Attach sender info and reverse for chronological display ────────────────
  const enriched = messages
    .map(m => ({
      ...m,
      sender: profiles[m.sender_id] ?? { name: null, avatar_url: null, email: null, linkedin_url: null },
    }))
    .reverse() // oldest first for display

  // ── Resolve reply_to previews ────────────────────────────────────────────────
  const replyToIds = [...new Set(enriched.filter(m => m.reply_to_id).map(m => m.reply_to_id as string))]
  const replyPreviews: Record<string, { content: string; sender_name: string | null }> = {}

  if (replyToIds.length > 0) {
    const { data: replyRows } = await supabase
      .from('hub_messages')
      .select('id, content, sender_id')
      .in('id', replyToIds)

    // Collect any additional sender IDs needed for reply previews
    const replySenderIds = [...new Set((replyRows ?? []).map(r => r.sender_id).filter(id => !profiles[id]))]
    const replyProfiles: typeof profiles = {}
    if (replySenderIds.length > 0) {
      const { data: rp } = await adminSupabase.from('profiles').select('id, name').in('id', replySenderIds)
      for (const p of rp ?? []) replyProfiles[p.id] = { name: p.name, avatar_url: null, email: null, linkedin_url: null }
    }

    for (const r of replyRows ?? []) {
      const senderName = (profiles[r.sender_id] ?? replyProfiles[r.sender_id])?.name ?? null
      replyPreviews[r.id] = { content: r.content, sender_name: senderName }
    }
  }

  const final = enriched.map(m => ({
    ...m,
    reply_preview: m.reply_to_id ? (replyPreviews[m.reply_to_id] ?? null) : null,
  }))

  return NextResponse.json({ messages: final, hasMore })
}
