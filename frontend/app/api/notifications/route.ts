import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Both the ownership filter and RLS. RLS already scopes this table, but
    // every other notifications query here carries the explicit filter and the
    // house rule is defence in depth — `notifications` is also absent from the
    // RLS regression suite in scripts/post-fix-verify.ts, so RLS was the sole
    // and unwatched guard on this read.
    //
    // The `opportunities (title, company_name)` embed that used to hang off
    // this select is gone: notifications-client.tsx renders `message` only and
    // never touched `notif.opportunities`, so the join cost bought nothing.
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[Notifications] list failed:', err)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action, notificationId } = body

    if (action === 'mark_all_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'mark_read' && typeof notificationId === 'string' && notificationId) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[Notifications] update failed:', err)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
