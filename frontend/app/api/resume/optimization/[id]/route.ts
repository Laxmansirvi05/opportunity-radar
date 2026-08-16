import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runTargetGeneration } from '@/lib/resume-optimizer/run'
import { targetResumeUnlocked, tierPlan, type Suggestion, type OptimizationTier } from '@/lib/resume-optimizer/tiers'
import type { ParsedResume } from '@/types/resume'

// ---------------------------------------------------------------------------
// GET /api/resume/optimization/[id]
// Fetch one persisted run. This is what makes a run survive logout.
//
// PATCH /api/resume/optimization/[id]
// Toggle one suggestion's completed state. When every suggestion becomes
// confirmed, this generates and scores Resume B. If a previously-confirmed
// suggestion is unchecked again, any existing target resume is cleared —
// it would otherwise present work as done that the student just un-confirmed.
//
// PATCH can trigger runTargetGeneration, which is 2 sequential AI-gateway
// calls (generation + evidence eval) with per-provider timeouts up to 40s
// each — see the note in the POST route for why this needs an explicit
// maxDuration rather than Vercel's default.
// ---------------------------------------------------------------------------
export const maxDuration = 300;

async function loadRun(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('resume_optimizations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const run = await loadRun(supabase, id, user.id)
  if (!run) {
    return NextResponse.json({ error: 'Optimisation run not found.' }, { status: 404 })
  }

  return NextResponse.json({ run })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const suggestionId = body?.suggestionId
  const completed = body?.completed
  if (typeof suggestionId !== 'string' || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'Provide suggestionId (string) and completed (boolean).' }, { status: 400 })
  }

  const run = await loadRun(supabase, id, user.id)
  if (!run) {
    return NextResponse.json({ error: 'Optimisation run not found.' }, { status: 404 })
  }

  const suggestions = (run.suggestions ?? []) as Suggestion[]
  const index = suggestions.findIndex((s) => s.id === suggestionId)
  if (index === -1) {
    return NextResponse.json({ error: 'Suggestion not found on this run.' }, { status: 404 })
  }

  const updatedSuggestions = suggestions.map((s, i) =>
    i === index ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null } : s
  )
  const unlocked = targetResumeUnlocked(updatedSuggestions)
  // polish_only derives suggestions as advice but never generates a Resume B
  // (tierPlan.generatesTarget is false for that tier) — without this check,
  // confirming a polish_only checklist would still trigger a generation call
  // for a resume the UI has nowhere to show or download.
  const generatesTarget = tierPlan(run.tier as OptimizationTier).generatesTarget

  const update: Record<string, unknown> = { suggestions: updatedSuggestions }

  // Un-confirming a suggestion after Resume B was generated invalidates it —
  // it presents that item as done, which is no longer true.
  if (!unlocked && (run.target_resume || run.target_score !== null)) {
    update.target_resume = null
    update.target_score = null
  }

  let warning: string | null = null

  // Trigger on target_score, not target_resume: a prior attempt may have
  // left an unscored draft resume cached in target_resume (see
  // TargetRunOutcome.partialResume) specifically so this retry can skip
  // straight to scoring instead of paying for generation again.
  if (generatesTarget && unlocked && run.target_score === null) {
    const outcome = await runTargetGeneration({
      resume: run.source_resume as ParsedResume,
      jobDescription: run.job_description as string,
      targetRole: run.target_role as string,
      companyName: run.company_name as string,
      completedSuggestions: updatedSuggestions.filter((s) => s.completed),
      userId: user.id,
      existingResume: (run.target_resume as ParsedResume | null) ?? undefined,
    })

    if (outcome.success) {
      update.target_resume = outcome.resume
      update.target_score = outcome.score
    } else {
      warning = outcome.error
      if (outcome.partialResume) {
        update.target_resume = outcome.partialResume
      }
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('resume_optimizations')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError || !updated) {
    console.error('[Optimizer] failed to update run', updateError)
    return NextResponse.json({ error: 'Could not save the checklist update. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ run: updated, warning })
}

// ---------------------------------------------------------------------------
// DELETE /api/resume/optimization/[id]
// Removes one saved Optimiser run from history. Scoped to the owning user
// via the .eq('user_id', ...) filter, not just the row id.
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error, count } = await supabase
    .from('resume_optimizations')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Optimizer] failed to delete run', error)
    return NextResponse.json({ error: 'Could not delete this run.' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: 'Optimisation run not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
