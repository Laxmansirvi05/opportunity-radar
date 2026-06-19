import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  SaveApplicationSchema,
  StageUpdateSchema,
  NotesUpdateSchema,
} from '@/types/tracker'

// ---------------------------------------------------------------------------
// GET /api/tracker — Fetch the full application board for the current user
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('get_application_board', {
    p_user_id: user.id,
  })

  if (error) {
    console.error('[Tracker GET] RPC error:', error.message)
    return NextResponse.json({ error: 'Failed to load board.' }, { status: 500 })
  }

  // Group by stage
  const board: Record<string, unknown[]> = {
    saved:     [],
    applied:   [],
    interview: [],
    offer:     [],
    rejected:  [],
  }

  for (const row of data ?? []) {
    if (row.stage in board) {
      board[row.stage].push(row)
    }
  }

  return NextResponse.json({ board })
}

// ---------------------------------------------------------------------------
// POST /api/tracker — Save an opportunity to the tracker (stage: 'saved')
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = SaveApplicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', details: parsed.error.issues },
      { status: 422 }
    )
  }

  // Verify opportunity exists
  const { data: opp } = await supabase
    .from('opportunities')
    .select('id')
    .eq('id', parsed.data.opportunity_id)
    .single()

  if (!opp) {
    return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })
  }

  // Count existing rows to compute initial position
  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('stage', 'saved')

  const column_position = ((count ?? 0) + 1) * 100

  const { data: newApp, error: insertError } = await supabase
    .from('applications')
    .insert({
      user_id:         user.id,
      opportunity_id:  parsed.data.opportunity_id,
      stage:           'saved',
      column_position,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique constraint: already in tracker
      return NextResponse.json(
        { error: 'Already in your tracker.' },
        { status: 409 }
      )
    }
    console.error('[Tracker POST] Insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to save.' }, { status: 500 })
  }

  // Log the save event
  await supabase.from('application_events').insert({
    application_id: newApp.id,
    user_id:        user.id,
    event_type:     'stage_change',
    payload:        { from: null, to: 'saved' },
  })

  return NextResponse.json({ application_id: newApp.id }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/tracker — Move stage or update notes (action based on body)
// Body: { application_id, action: 'stage' | 'notes', ...payload }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { application_id?: string; action?: string; [key: string]: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.application_id || !body.action) {
    return NextResponse.json(
      { error: 'application_id and action are required.' },
      { status: 422 }
    )
  }

  // Ownership check
  const { data: app, error: fetchError } = await supabase
    .from('applications')
    .select('id, stage, user_id')
    .eq('id', body.application_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !app) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  }

  // ── Stage change ─────────────────────────────────────────────────────────
  if (body.action === 'stage') {
    const stageUpdate = StageUpdateSchema.safeParse(body)
    if (!stageUpdate.success) {
      return NextResponse.json(
        { error: 'Invalid stage update.', details: stageUpdate.error.issues },
        { status: 422 }
      )
    }

    const update: Record<string, unknown> = {
      stage:           stageUpdate.data.stage,
      column_position: stageUpdate.data.column_position ?? 100,
    }

    let snapshots: Record<string, unknown> = {}

    // Capture score snapshots when moving to 'applied'
    if (stageUpdate.data.stage === 'applied' && app.stage !== 'applied') {
      update.applied_at = new Date().toISOString()

      // Fetch ATS score snapshot from the analyze endpoint (internal call)
      const opportunityRow = await supabase
        .from('applications')
        .select('opportunity_id')
        .eq('id', body.application_id)
        .single()

      if (opportunityRow.data) {
        const atsRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/ats/analyze?opportunity_id=${opportunityRow.data.opportunity_id}`,
          { headers: req.headers }
        )
        if (atsRes.ok) {
          const atsData = await atsRes.json()
          if (!atsData.fallback) {
            update.ats_score_snapshot   = atsData.ats_score
            snapshots.ats_score         = atsData.ats_score
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update(update)
      .eq('id', body.application_id)

    if (updateError) {
      return NextResponse.json({ error: 'Stage update failed.' }, { status: 500 })
    }

    // Log event
    await supabase.from('application_events').insert({
      application_id: body.application_id,
      user_id:        user.id,
      event_type:     'stage_change',
      payload:        { from: app.stage, to: stageUpdate.data.stage, ...snapshots },
    })

    return NextResponse.json({ success: true, snapshots })
  }

  // ── Notes update ─────────────────────────────────────────────────────────
  if (body.action === 'notes') {
    const notesUpdate = NotesUpdateSchema.safeParse(body)
    if (!notesUpdate.success) {
      return NextResponse.json(
        { error: 'Invalid notes update.', details: notesUpdate.error.issues },
        { status: 422 }
      )
    }

    await supabase
      .from('applications')
      .update({ notes: notesUpdate.data.notes })
      .eq('id', body.application_id)

    await supabase.from('application_events').insert({
      application_id: body.application_id,
      user_id:        user.id,
      event_type:     'note_added',
      payload:        { preview: notesUpdate.data.notes.slice(0, 100) },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 422 })
}
