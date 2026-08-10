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
