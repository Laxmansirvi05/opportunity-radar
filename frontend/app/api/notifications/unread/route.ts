import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) throw error

    return NextResponse.json({ unreadCount: count || 0 })
  } catch (err) {
    console.error('[Notifications] unread count failed:', err)
    return NextResponse.json({ error: 'Failed to load unread count' }, { status: 500 })
  }
}
