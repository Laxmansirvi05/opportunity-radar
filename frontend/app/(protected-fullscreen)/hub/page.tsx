import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { HubClient } from '@/features/hub/components/hub-client'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // `profiles` SELECT RLS is `auth.uid() = id` — a user can only read their
  // OWN row through the regular client. Hub is a public chat where every
  // member's name/avatar must be visible to every other member, so looking
  // up OTHER senders' profiles needs the service-role client, same as
  // /api/hub/messages and /api/hub/send already correctly do. Using the
  // regular client here silently returned null for every sender who wasn't
  // the viewer themselves — every message read "Student" with no avatar.
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Fetch current user profile to pass to client
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url, email, linkedin_url')
    .eq('id', user.id)
    .single()

  const currentUserSender = {
    name: profile?.name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    email: profile?.email ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
  }

  // 2. Fetch initial messages server-side
  // We mimic the logic in /api/hub/messages for initial SSR
  const PAGE_SIZE = 50
  const { data: rawMessages, error: messagesError } = await supabase
    .from('hub_messages')
    .select('id, sender_id, content, reply_to_id, created_at, image_url, image_width, image_height, edited_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  let errorString = null
  if (messagesError) {
    console.error('[Hub Server] Failed to load messages:', {
      message: messagesError?.message,
      code: messagesError?.code,
      details: messagesError?.details,
      hint: messagesError?.hint
    })
    errorString = `Database Error: ${messagesError?.message || 'Unknown'}`
  }

  const hasMore = (rawMessages?.length ?? 0) > PAGE_SIZE
  const messages = (rawMessages ?? []).slice(0, PAGE_SIZE)

  const senderIds = [...new Set(messages.map(m => m.sender_id))]
  const profilesDict: Record<string, typeof currentUserSender> = {}

  if (senderIds.length > 0) {
    const { data: profileRows } = await adminSupabase
      .from('profiles')
      .select('id, name, avatar_url, email, linkedin_url')
      .in('id', senderIds)

    for (const p of profileRows ?? []) {
      profilesDict[p.id] = { name: p.name, avatar_url: p.avatar_url, email: p.email, linkedin_url: p.linkedin_url }
    }
  }

  const enriched = messages
    .map(m => ({
      ...m,
      sender: profilesDict[m.sender_id] ?? { name: null, avatar_url: null, email: null, linkedin_url: null },
    }))
    .reverse()

  const replyToIds = [...new Set(enriched.filter(m => m.reply_to_id).map(m => m.reply_to_id as string))]
  const replyPreviews: Record<string, { content: string; sender_name: string | null }> = {}

  if (replyToIds.length > 0) {
    const { data: replyRows } = await supabase
      .from('hub_messages')
      .select('id, content, sender_id')
      .in('id', replyToIds)

    const replySenderIds = [...new Set((replyRows ?? []).map(r => r.sender_id).filter(id => !profilesDict[id]))]
    const replyProfiles: typeof profilesDict = {}
    if (replySenderIds.length > 0) {
      const { data: rp } = await adminSupabase.from('profiles').select('id, name').in('id', replySenderIds)
      for (const p of rp ?? []) replyProfiles[p.id] = { name: p.name, avatar_url: null, email: null, linkedin_url: null }
    }

    for (const r of replyRows ?? []) {
      const senderName = (profilesDict[r.sender_id] ?? replyProfiles[r.sender_id])?.name ?? null
      replyPreviews[r.id] = { content: r.content, sender_name: senderName }
    }
  }

  const finalMessages = enriched.map(m => ({
    ...m,
    reply_preview: m.reply_to_id ? (replyPreviews[m.reply_to_id] ?? null) : null,
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen w-full">
      {/* Client Component */}
      <div className="flex-1 min-h-0 relative">
        <HubClient 
          currentUserId={user.id}
          currentUserSender={currentUserSender}
          initialMessages={finalMessages}
          initialHasMore={hasMore}
          initialError={errorString}
        />
      </div>
    </div>
  )
}
