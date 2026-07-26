import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase admin credentials')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()
    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: trackers, error: trackerError } = await supabase
      .from('application_tracker')
      .select(`
        user_id, 
        opportunity_id, 
        opportunities!inner(title, company_name, deadline, status)
      `)
      .eq('status', 'Saved')
      .eq('opportunities.status', 'Published')
      .gt('opportunities.deadline', now)
      .lte('opportunities.deadline', fortyEightHoursFromNow)

    if (trackerError) throw trackerError

    const { data: existingNotifs, error: notifError } = await supabase
      .from('notifications')
      .select('user_id, related_opportunity_id')
      .eq('type', 'DeadlineAlert')

    if (notifError) throw notifError

    const existingSet = new Set(existingNotifs?.map(n => `${n.user_id}-${n.related_opportunity_id}`))

    const newNotifs = (trackers || [])
      .filter(t => !existingSet.has(`${t.user_id}-${t.opportunity_id}`))
      .map(t => ({
        user_id: t.user_id,
        type: 'DeadlineAlert',
        related_opportunity_id: t.opportunity_id,
        message: `Application deadline for ${(t.opportunities as any).title} at ${(t.opportunities as any).company_name} is approaching within 48 hours.`,
      }))

    if (newNotifs.length > 0) {
      const { error: insertError } = await supabase.from('notifications').insert(newNotifs)
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, alertsCreated: newNotifs.length })
  } catch (error: any) {
    console.error('[Cron/Notifications] failed:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
