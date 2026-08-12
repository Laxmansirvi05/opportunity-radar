'use server'

import { createClient } from '@/lib/supabase/server'
import { convertResumeDataToParsedResume, looksLikeParsedResume } from '@/lib/resume-optimizer/convert-resume-data'
import { sanitizeFilterTerm } from '@/features/opportunities/services/opportunity-service'
import type { ParsedResume } from '@/types/resume'

/**
 * Real data for the Resume Toolkit's "Career Insights" rail — replacing a
 * panel that previously hardcoded "React.js / UX Design / Typescript / Figma",
 * a fake "+12% this month" trend, and "342 active roles" for every single
 * user regardless of whether they had ever uploaded a resume. Every field
 * here is either computed from this user's real rows or, when there isn't
 * enough real data yet, an honest empty state — never a filled-in guess.
 */

export interface ScorePoint {
  score: number
  label: string
  date: string
}

export interface CareerInsights {
  topSkills: string[]
  scoreHistory: ScorePoint[]
  matchingOpportunities: number | null
}

export async function getCareerInsights(): Promise<CareerInsights> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { topSkills: [], scoreHistory: [], matchingOpportunities: null }
  }

  const [skills, scoreHistory] = await Promise.all([
    getTopSkills(supabase, user.id),
    getScoreHistory(supabase, user.id),
  ])

  const matchingOpportunities = skills.length > 0
    ? await countMatchingOpportunities(supabase, skills)
    : null

  return { topSkills: skills, scoreHistory, matchingOpportunities }
}

async function getTopSkills(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  // Prefer a saved resume (Resume Builder / uploaded-and-saved) — the
  // student's canonical, current resume.
  const { data: saved } = await supabase
    .from('resumes')
    .select('parsed_data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (saved?.parsed_data) {
    const raw = saved.parsed_data as Record<string, unknown>
    const resume = looksLikeParsedResume(raw) ? (raw as unknown as ParsedResume) : convertResumeDataToParsedResume(raw)
    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      return resume.skills.slice(0, 8)
    }
  }

  // Fall back to whatever resume was most recently run through the
  // Optimiser — the only other place a full resume gets persisted for an
  // account that has never saved one via the Builder/upload flow.
  const { data: run } = await supabase
    .from('resume_optimizations')
    .select('source_resume, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const skills = (run?.source_resume as ParsedResume | null)?.skills
  return Array.isArray(skills) ? skills.slice(0, 8) : []
}

async function getScoreHistory(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<ScorePoint[]> {
  const [atsReports, optimizations] = await Promise.all([
    supabase
      .from('resume_ats_reports')
      .select('score, created_at, resumes!inner(user_id)')
      .eq('resumes.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('resume_optimizations')
      .select('baseline_score, target_role, company_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const points: ScorePoint[] = []

  for (const r of atsReports.data ?? []) {
    if (typeof r.score === 'number') {
      points.push({ score: Math.round(r.score), label: 'ATS check', date: r.created_at as string })
    }
  }
  for (const r of optimizations.data ?? []) {
    if (typeof r.baseline_score === 'number') {
      points.push({
        score: Math.round(r.baseline_score),
        label: `${r.target_role || 'Role'} · ${r.company_name || 'Company'}`,
        date: r.created_at as string,
      })
    }
  }

  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return points.slice(-6)
}

export interface LatestSuggestionSummary {
  title: string
  importance: 'critical' | 'high' | 'medium' | 'low'
}

export type LatestAnalysis =
  | null
  | {
      kind: 'ats'
      id: string
      score: number
      jobLabel: string
      createdAt: string
      topSuggestions: LatestSuggestionSummary[]
    }
  | {
      kind: 'optimizer'
      id: string
      score: number
      targetRole: string
      companyName: string
      tier: string | null
      createdAt: string
      topSuggestions: LatestSuggestionSummary[]
    }

/**
 * The single most recent ATS check or Optimiser run, whichever is newer —
 * the "current result" a returning user should see as the main content
 * instead of the first-time onboarding hero (that hero stays for a user with
 * neither kind of history yet).
 */
export async function getLatestAnalysis(): Promise<LatestAnalysis> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [atsReport, optimization] = await Promise.all([
    supabase
      .from('resume_ats_reports')
      .select('id, score, created_at, target_job_description, report_data, resumes!inner(user_id)')
      .eq('resumes.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('resume_optimizations')
      .select('id, baseline_score, target_role, company_name, tier, suggestions, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const atsRow = atsReport.data
  const optRow = optimization.data
  if (!atsRow && !optRow) return null

  const atsTime = atsRow ? new Date(atsRow.created_at as string).getTime() : -Infinity
  const optTime = optRow ? new Date(optRow.created_at as string).getTime() : -Infinity

  if (atsTime >= optTime && atsRow) {
    const reportData = atsRow.report_data as { suggestions?: LatestSuggestionSummary[] } | null
    const jd = (atsRow.target_job_description as string | null) ?? ''
    return {
      kind: 'ats',
      id: atsRow.id as string,
      score: Math.round(atsRow.score as number),
      jobLabel: jd.trim().length > 0 ? jd.trim().slice(0, 60) : 'ATS check',
      createdAt: atsRow.created_at as string,
      topSuggestions: (reportData?.suggestions ?? []).slice(0, 3).map((s) => ({ title: s.title, importance: s.importance })),
    }
  }

  if (optRow) {
    return {
      kind: 'optimizer',
      id: optRow.id as string,
      score: Math.round(optRow.baseline_score as number),
      targetRole: (optRow.target_role as string) || 'Role',
      companyName: (optRow.company_name as string) || 'Company',
      tier: (optRow.tier as string) ?? null,
      createdAt: optRow.created_at as string,
      topSuggestions: ((optRow.suggestions as LatestSuggestionSummary[] | null) ?? []).slice(0, 3).map((s) => ({ title: s.title, importance: s.importance })),
    }
  }

  return null
}

export interface AtsHistoryItem {
  id: string
  score: number
  jobLabel: string
  createdAt: string
}

export interface OptimizerHistoryItem {
  id: string
  baselineScore: number
  targetRole: string
  companyName: string
  tier: string | null
  createdAt: string
}

/**
 * Full, separate history lists for the /resume dashboard's bottom section —
 * distinct from getScoreHistory's combined 6-point sparkline above. ATS
 * checks and Optimiser runs must never be merged into one list: they are
 * different kinds of record with different "reopen" destinations.
 */
export async function getFullHistory(): Promise<{ ats: AtsHistoryItem[]; optimizer: OptimizerHistoryItem[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ats: [], optimizer: [] }

  const [atsReports, optimizations] = await Promise.all([
    supabase
      .from('resume_ats_reports')
      .select('id, score, created_at, target_job_description, resumes!inner(user_id)')
      .eq('resumes.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('resume_optimizations')
      .select('id, baseline_score, target_role, company_name, tier, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const ats: AtsHistoryItem[] = (atsReports.data ?? []).map((r) => ({
    id: r.id as string,
    score: Math.round(r.score as number),
    jobLabel: ((r.target_job_description as string | null) ?? '').trim().slice(0, 60) || 'Resume-only check',
    createdAt: r.created_at as string,
  }))

  const optimizer: OptimizerHistoryItem[] = (optimizations.data ?? []).map((r) => ({
    id: r.id as string,
    baselineScore: Math.round(r.baseline_score as number),
    targetRole: (r.target_role as string) || 'Role',
    companyName: (r.company_name as string) || 'Company',
    tier: (r.tier as string) ?? null,
    createdAt: r.created_at as string,
  }))

  return { ats, optimizer }
}

async function countMatchingOpportunities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skills: string[]
): Promise<number | null> {
  const terms = skills.map(sanitizeFilterTerm).filter((s) => s.length > 0).slice(0, 8)
  if (terms.length === 0) return null

  // One request via the opportunities -> opportunity_tags join, filtering
  // both sides server-side. An earlier version fetched matching tag rows
  // first and passed the (frequently 400+) opportunity ids into a second
  // query's .in() filter — for common skills like "Git" or "GitHub" that
  // built a request URL north of 16KB and failed outright with a header
  // overflow, silently degrading to "no data" for exactly the students
  // whose skills matched the most listings.
  const { count, error } = await supabase
    .from('opportunities')
    .select('id, opportunity_tags!inner(tag_name)', { count: 'exact', head: true })
    .in('status', ['Published', 'Closing Soon'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .or(terms.map((t) => `tag_name.ilike.%${t}%`).join(','), { foreignTable: 'opportunity_tags' })

  return error ? null : (count ?? 0)
}
