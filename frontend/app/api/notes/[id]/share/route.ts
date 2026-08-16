import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { NoteShare, NoteShareRecipient, SharePermission, ShareLinkAccess } from '@/features/notes/types'

export const runtime = 'nodejs'

const LINK_ACCESS: ShareLinkAccess[] = ['private', 'view']
const PERMISSIONS: SharePermission[] = ['view', 'edit']

/**
 * `profiles` SELECT RLS is `auth.uid() = id`, so neither resolving "who is
 * this email" nor rendering "shared with Priya" can go through the caller's
 * own client — it can only ever read the caller's own row. Same reason and
 * same pattern as /api/hub/senders: the service-role key stays server-side
 * inside an already-authenticated, ownership-checked route, and only the
 * public-facing profile fields are ever returned.
 */
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Confirms the caller owns this note before any sharing state is read or changed. */
async function assertOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  noteId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('notes')
    .select('id')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

async function readShare(
  supabase: Awaited<ReturnType<typeof createClient>>,
  noteId: string,
  userId: string
): Promise<NoteShare | null> {
  const [shareResult, recipientResult] = await Promise.all([
    supabase.from('note_shares').select('slug, link_access').eq('note_id', noteId).eq('owner_id', userId).maybeSingle(),
    supabase
      .from('note_share_recipients')
      .select('id, recipient_id, permission')
      .eq('note_id', noteId)
      .eq('owner_id', userId),
  ])

  // Defensive: a non-array response (an error shape, a single-row read) must
  // degrade to "no recipients" rather than throwing inside the share panel.
  const rows = Array.isArray(recipientResult.data) ? recipientResult.data : []

  // One batched profile lookup for every recipient, rather than a join the
  // caller's client is not permitted to make (see adminClient above).
  const profileById = new Map<string, { name: string | null; email: string | null; avatar_url: string | null }>()
  if (rows.length > 0) {
    const { data: profiles } = await adminClient()
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', rows.map((row) => row.recipient_id as string))
    for (const profile of profiles ?? []) {
      profileById.set(profile.id as string, {
        name: profile.name as string | null,
        email: profile.email as string | null,
        avatar_url: profile.avatar_url as string | null,
      })
    }
  }

  const recipients: NoteShareRecipient[] = rows.map((row) => {
    const profile = profileById.get(row.recipient_id as string)
    return {
      id: row.id as string,
      recipient_id: row.recipient_id as string,
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
      permission: row.permission as SharePermission,
    }
  })

  if (!shareResult.data && recipients.length === 0) return null

  return {
    slug: (shareResult.data?.slug as string) ?? '',
    link_access: (shareResult.data?.link_access as ShareLinkAccess) ?? 'private',
    recipients,
  }
}

/** GET /api/notes/[id]/share — current sharing state, or null when never shared. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwned(supabase, id, user.id))) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ share: await readShare(supabase, id, user.id) })
}

/**
 * PUT /api/notes/[id]/share — set link access. Body: { link_access }.
 *
 * 'view' is the only non-private link level: anonymous *edit* would be an
 * unauthenticated write endpoint against a user's own data, with no identity
 * to attribute or rate-limit it to. Editing is offered through named
 * recipients instead, where a real session backs every write.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwned(supabase, id, user.id))) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  let body: { link_access?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!LINK_ACCESS.includes(body.link_access as ShareLinkAccess)) {
    return NextResponse.json({ error: 'Unknown link access level' }, { status: 400 })
  }
  const linkAccess = body.link_access as ShareLinkAccess

  const { data: existing } = await supabase
    .from('note_shares')
    .select('slug')
    .eq('note_id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('note_shares')
      .update({ link_access: linkAccess })
      .eq('note_id', id)
      .eq('owner_id', user.id)
    if (error) {
      console.error('[Notes] Failed to update link access:', error)
      return NextResponse.json({ error: 'Failed to update sharing' }, { status: 500 })
    }
  } else {
    // A fresh, unguessable token. Revoking and re-sharing keeps the same
    // slug, which is deliberate: a link the owner already sent to someone
    // should start working again when they turn sharing back on.
    const slug = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase
      .from('note_shares')
      .insert({ note_id: id, owner_id: user.id, slug, link_access: linkAccess })
    if (error) {
      console.error('[Notes] Failed to create share:', error)
      return NextResponse.json({ error: 'Failed to update sharing' }, { status: 500 })
    }
  }

  return NextResponse.json({ share: await readShare(supabase, id, user.id) })
}

/** POST /api/notes/[id]/share — add a recipient. Body: { email, permission }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwned(supabase, id, user.id))) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  let body: { email?: unknown; permission?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'Enter an email address' }, { status: 400 })
  }
  const permission: SharePermission = PERMISSIONS.includes(body.permission as SharePermission)
    ? (body.permission as SharePermission)
    : 'view'

  const { data: recipient } = await adminClient()
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (!recipient) {
    return NextResponse.json(
      { error: 'No Opportunity Radar account uses that email address' },
      { status: 404 }
    )
  }
  if (recipient.id === user.id) {
    return NextResponse.json({ error: 'You already have access to this note' }, { status: 400 })
  }

  const { error } = await supabase
    .from('note_share_recipients')
    .upsert(
      { note_id: id, owner_id: user.id, recipient_id: recipient.id, permission },
      { onConflict: 'note_id,recipient_id' }
    )

  if (error) {
    console.error('[Notes] Failed to add share recipient:', error)
    return NextResponse.json({ error: 'Failed to share note' }, { status: 500 })
  }

  return NextResponse.json({ share: await readShare(supabase, id, user.id) })
}

/**
 * DELETE /api/notes/[id]/share
 *
 * ?recipient_id=… removes one person; with no parameter it revokes
 * everything — link and all recipients — which is what the "Stop sharing"
 * control does.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwned(supabase, id, user.id))) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const recipientId = new URL(req.url).searchParams.get('recipient_id')

  if (recipientId) {
    const { error } = await supabase
      .from('note_share_recipients')
      .delete()
      .eq('note_id', id)
      .eq('owner_id', user.id)
      .eq('recipient_id', recipientId)
    if (error) {
      console.error('[Notes] Failed to remove share recipient:', error)
      return NextResponse.json({ error: 'Failed to update sharing' }, { status: 500 })
    }
    return NextResponse.json({ share: await readShare(supabase, id, user.id) })
  }

  const [recipients, share] = await Promise.all([
    supabase.from('note_share_recipients').delete().eq('note_id', id).eq('owner_id', user.id),
    supabase.from('note_shares').update({ link_access: 'private' }).eq('note_id', id).eq('owner_id', user.id),
  ])

  if (recipients.error || share.error) {
    console.error('[Notes] Failed to revoke sharing:', recipients.error ?? share.error)
    return NextResponse.json({ error: 'Failed to update sharing' }, { status: 500 })
  }

  return NextResponse.json({ share: await readShare(supabase, id, user.id) })
}
