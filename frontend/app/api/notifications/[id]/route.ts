import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  // Next 16 hands dynamic segments to route handlers as a Promise. This
  // handler used to declare `{ params: { id: string } }` and read `params.id`
  // straight off it, which is `undefined` at runtime — every delete sent
  // `id=eq.undefined` at a uuid column and came back a 500. The mismatch was
  // invisible because `typescript.ignoreBuildErrors` is on.
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Notifications] delete failed:', err)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
