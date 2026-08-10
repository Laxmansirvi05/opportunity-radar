import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const MAX_LENGTH = 2000

/**
 * POST /api/hub/send
 *
 * Body: { content: string; reply_to_id?: string; image_url?: string; image_width?: number; image_height?: number }
 *
 * sender_id is ALWAYS derived from the authenticated session server-side.
 * The client cannot supply or override it. An image-only message (empty
 * content) is valid as long as image_url is present — the database
 * constraint is the actual source of truth for this rule.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    content?: unknown
    reply_to_id?: unknown
    image_url?: unknown
    image_width?: unknown
    image_height?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const replyToId = typeof body.reply_to_id === 'string' ? body.reply_to_id : null

  // Only trust an image_url that actually points into this user's own folder
  // in the hub-attachments bucket — otherwise a message could be crafted to
  // "attach" an arbitrary external image URL or another user's private path.
  const rawImageUrl = typeof body.image_url === 'string' ? body.image_url : null
  const imageUrl = rawImageUrl && rawImageUrl.includes(`/hub-attachments/${user.id}/`) ? rawImageUrl : null
  const imageWidth = imageUrl && typeof body.image_width === 'number' ? Math.round(body.image_width) : null
  const imageHeight = imageUrl && typeof body.image_height === 'number' ? Math.round(body.image_height) : null

  if (!content && !imageUrl) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  if (content.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Message exceeds ${MAX_LENGTH} characters` }, { status: 400 })
  }

  // Validate reply_to_id exists if provided
  if (replyToId) {
    const { error: replyCheckError } = await supabase
      .from('hub_messages')
      .select('id')
      .eq('id', replyToId)
      .single()

    if (replyCheckError) {
      // Non-fatal: insert anyway without reply linkage if the target is gone
      console.warn('[Hub] reply_to_id not found, inserting without reply link:', replyToId)
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('hub_messages')
    .insert({
      sender_id: user.id, // always from server session
      content,
      reply_to_id: replyToId,
      image_url: imageUrl,
      image_width: imageWidth,
      image_height: imageHeight,
    })
    .select('id, sender_id, content, reply_to_id, created_at, image_url, image_width, image_height, edited_at')
    .single()

  if (insertError) {
    console.error('[Hub] Failed to insert message:', {
      message: insertError?.message,
      code: insertError?.code,
      details: insertError?.details,
      hint: insertError?.hint
    })
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? insertError : undefined
    }, { status: 500 })
  }

  // Use admin client to bypass RLS when reading public profile information
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch sender profile for the response so the optimistic message can be reconciled
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('name, avatar_url, email, linkedin_url')
    .eq('id', user.id)
    .single()

  let replyPreview = null
  if (replyToId) {
    const { data: replyMsg } = await supabase
      .from('hub_messages')
      .select('id, content, sender_id')
      .eq('id', replyToId)
      .single()

    if (replyMsg) {
      const { data: replySender } = await adminSupabase
        .from('profiles')
        .select('name')
        .eq('id', replyMsg.sender_id)
        .single()

      replyPreview = { content: replyMsg.content, sender_name: replySender?.name ?? null }
    }
  }

  return NextResponse.json({
    message: {
      ...inserted,
      sender: {
        name: profile?.name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: profile?.email ?? null,
        linkedin_url: profile?.linkedin_url ?? null,
      },
      reply_preview: replyPreview,
    },
  })
}
