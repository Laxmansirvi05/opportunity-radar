import React from 'react';
import Link from 'next/link';
import { listResumes } from '@/features/resume-toolkit/services/resume-actions';
import { getCareerInsights, getLatestAnalysis, getFullHistory } from '@/features/resume-toolkit/services/career-insights';
import { ResumeListClient } from '@/features/resume-toolkit/components/resume-list-client';
import { AtsHistoryList, OptimizerHistoryList } from '@/features/resume-toolkit/components/history-lists-client';
import { LatestAnalysisActions } from '@/features/resume-toolkit/components/latest-analysis-actions';

function matchLevelLabel(score: number): string {
  if (score >= 90) return 'Exceptional match';
  if (score >= 78) return 'Strong match';
  if (score >= 65) return 'Moderate match';
  if (score >= 50) return 'Partial match';
  if (score >= 35) return 'Weak match';
  return 'Poor match';
}

const importanceColor: Record<string, string> = {
  critical: '#943700',
  high: '#943700',
  medium: '#434655',
  low: '#737686',
};

export default async function ResumeToolkitPrototype() {
  const [result, insights, latestAnalysis, history] = await Promise.all([
    listResumes(),
    getCareerInsights(),
    getLatestAnalysis(),
    getFullHistory(),
  ]);
  const resumes = result.success ? result.resumes : [];

  return (
    <div className="flex flex-col w-full gap-8 font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
    <div className="flex flex-col lg:flex-row w-full gap-8 lg:items-start">

      {/* ═══════════════════════════════════════════════════════════
          LEFT COLUMN — Workspace Tools
          ═══════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#191b23', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          Workspace Tools
        </h2>

        {/* Card 1: Build from Scratch */}
        <Link href="/resume/builder" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            padding: '16px', borderRadius: '12px',
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px',
              backgroundColor: '#dbe1ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#004ac6' }}>architecture</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#191b23' }}>Build from Scratch</span>
            <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.5 }}>
              Guided workflow to create a modern, professional resume.
            </span>
          </div>
        </Link>

        {/* Card 2: Extract & Edit */}
        <Link href="/resume/upload" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            padding: '16px', borderRadius: '12px',
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px',
              backgroundColor: '#71f8e4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#006b5f' }}>post_add</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#191b23' }}>Extract &amp; Edit</span>
            <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.5 }}>
              Import existing documents and convert to editable format.
            </span>
          </div>
        </Link>

        {/* Card 3: ATS Score Checker */}
        <Link href="/resume/ats" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            padding: '16px', borderRadius: '12px',
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px',
              backgroundColor: '#ffdbcd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#943700' }}>fact_check</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#191b23' }}>ATS Score Checker</span>
            <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.5 }}>
              Instant feedback on how well your resume reads by robots.
            </span>
          </div>
        </Link>

        {/* Card 4: AI Optimizer */}
        <Link href="/resume/copilot" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '2px',
            borderRadius: '14px',
            border: '2px solid #004ac6',
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              padding: '16px', borderRadius: '12px',
              backgroundColor: '#004ac6', cursor: 'pointer',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#ffffff' }}>auto_fix_high</span>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>AI Optimizer</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                Your real ATS score against a job description, plus gap-derived suggestions.
              </span>
            </div>
          </div>
        </Link>

        {/* Resumes List */}
        <div className="mt-6 flex flex-col gap-4">
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#191b23', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Your Resumes
          </h2>
          {resumes.length > 0 ? (
            <ResumeListClient initialResumes={resumes} />
          ) : (
            <div className="text-sm text-on-surface-variant p-4 border border-outline-variant rounded-xl bg-surface">
              No resumes created yet. Click &quot;Build from Scratch&quot; to get started.
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CENTER COLUMN — AI Resume Optimizer
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Header: Title + AI Powered badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#191b23', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
              AI Resume Optimizer
            </h1>
            <p style={{ fontSize: '15px', color: '#434655', margin: 0, lineHeight: 1.5 }}>
              Perfecting your profile for specific career opportunities.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '9999px',
            backgroundColor: '#6df5e1', color: '#006f64',
            fontSize: '13px', fontWeight: 600,
            marginTop: '4px', whiteSpace: 'nowrap',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
            AI Powered
          </div>
        </div>

        {/* Main Card — a real call-to-action, not a fabricated score.
            This used to show a hardcoded "68" ATS score, fake gaps, and
            buttons with no click handler at all. Never show a student a
            number or a result you made up — the real thing lives at
            /resume/copilot and needs their actual resume and a job
            description to produce anything honest.

            For a returning user (one who already has an ATS check or
            Optimiser run), the onboarding pitch below is replaced by their
            actual latest result — re-showing "score your resume" to someone
            who already has a score buries the one thing they'd actually
            want to see first. */}
        {latestAnalysis ? (
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: '32px',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '16px', flexShrink: 0,
                backgroundColor: latestAnalysis.score >= 65 ? '#dbe1ff' : '#ffdbcd',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: latestAnalysis.score >= 65 ? '#004ac6' : '#943700' }}>
                  {latestAnalysis.score}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#737686', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>
                  {matchLevelLabel(latestAnalysis.score)} · Current {latestAnalysis.kind === 'ats' ? 'ATS Score' : 'Optimiser Run'}
                </p>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#191b23', margin: 0, lineHeight: 1.3 }}>
                  {latestAnalysis.kind === 'optimizer'
                    ? `${latestAnalysis.targetRole} · ${latestAnalysis.companyName}`
                    : latestAnalysis.jobLabel}
                </h3>
              </div>
            </div>

            {latestAnalysis.topSuggestions.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#434655', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>
                  Current gaps
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {latestAnalysis.topSuggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#191b23' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: importanceColor[s.importance] ?? '#737686', flexShrink: 0 }} />
                      {s.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href="/resume/copilot"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  height: '40px', padding: '0 20px',
                  borderRadius: '8px', border: 'none',
                  backgroundColor: '#004ac6', color: '#ffffff',
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                Continue in Optimiser
              </Link>
              <Link
                href="/resume/ats"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  height: '40px', padding: '0 20px',
                  borderRadius: '8px', border: '1px solid #E2E8F0',
                  backgroundColor: '#ffffff', color: '#191b23',
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                Run a new ATS check
              </Link>
              <LatestAnalysisActions
                resume={latestAnalysis.sourceResume}
                label={latestAnalysis.kind === 'optimizer' ? `${latestAnalysis.targetRole} · ${latestAnalysis.companyName}` : latestAnalysis.jobLabel}
                downloadHref={latestAnalysis.downloadHref}
              />
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: '40px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              backgroundColor: '#dbe1ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#004ac6' }}>auto_fix_high</span>
            </div>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#191b23', margin: '0 0 8px 0' }}>
                Score your resume against a real job
              </h3>
              <p style={{ fontSize: '14px', color: '#434655', lineHeight: 1.6, margin: 0, maxWidth: '420px' }}>
                Upload or pick a resume, paste a job description, and get your real ATS score, gap-derived
                suggestions, and two downloadable versions — never a number we made up.
              </p>
            </div>
            <Link
              href="/resume/copilot"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                height: '44px', padding: '0 24px',
                borderRadius: '8px', border: 'none',
                backgroundColor: '#004ac6', color: '#ffffff',
                fontSize: '15px', fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              Open the optimiser
            </Link>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT COLUMN — Career Insights (real data only; every field
          below is computed live in getCareerInsights() from this user's
          own rows, with an honest empty state when there isn't enough
          history yet — never a filled-in placeholder number).
          ═══════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[280px] shrink-0">
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
          borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', flexDirection: 'column',
        }}>

          {/* Heading */}
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#191b23', letterSpacing: '-0.01em', lineHeight: 1.2, margin: '0 0 20px 0' }}>
            Career Insights
          </h2>

          {/* Recent ATS Scores */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#434655', lineHeight: 1.3 }}>
                Recent<br />ATS Scores
              </span>
              {insights.scoreHistory.length >= 2 && (
                <span style={{
                  fontSize: '14px', fontWeight: 700, lineHeight: 1.3, textAlign: 'right',
                  color: insights.scoreHistory[insights.scoreHistory.length - 1].score >= insights.scoreHistory[0].score ? '#006f64' : '#943700',
                }}>
                  {insights.scoreHistory[insights.scoreHistory.length - 1].score >= insights.scoreHistory[0].score ? '+' : ''}
                  {insights.scoreHistory[insights.scoreHistory.length - 1].score - insights.scoreHistory[0].score} vs first check
                </span>
              )}
            </div>

            {insights.scoreHistory.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#737686', lineHeight: 1.5, margin: 0 }}>
                Run an ATS check or optimisation to start tracking your scores here.
              </p>
            ) : insights.scoreHistory.length === 1 ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: '#004ac6' }}>{insights.scoreHistory[0].score}</span>
                <span style={{ fontSize: '12px', color: '#737686' }}>{insights.scoreHistory[0].label}</span>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                  height: '100px', gap: '6px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #E2E8F0',
                }}>
                  {insights.scoreHistory.map((p, i) => (
                    <div
                      key={i}
                      title={`${p.label}: ${p.score}`}
                      style={{
                        flex: 1,
                        backgroundColor: i === insights.scoreHistory.length - 1 ? '#004ac6' : '#dbe1ff',
                        height: `${Math.max(p.score, 4)}%`,
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: '6px',
                  fontSize: '11px', fontWeight: 700, color: '#737686',
                  textTransform: 'uppercase', letterSpacing: '0.01em',
                }}>
                  <span>{formatShortDate(insights.scoreHistory[0].date)}</span>
                  <span>{formatShortDate(insights.scoreHistory[insights.scoreHistory.length - 1].date)}</span>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#E2E8F0', marginBottom: '20px' }} />

          {/* Top Skills Detected */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '12px', fontWeight: 700, color: '#434655',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: '12px', margin: '0 0 12px 0',
            }}>
              TOP SKILLS DETECTED
            </h3>
            {insights.topSkills.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#737686', lineHeight: 1.5, margin: 0 }}>
                Upload a resume in the ATS Checker or Optimiser to see your top skills here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {insights.topSkills.slice(0, 6).map((skill) => (
                  <span key={skill} style={{
                    padding: '5px 10px', borderRadius: '4px',
                    backgroundColor: '#ededf9',
                    fontSize: '13px', fontWeight: 500, color: '#191b23',
                  }}>{skill}</span>
                ))}
                {insights.topSkills.length > 6 && (
                  <span style={{
                    padding: '5px 10px', borderRadius: '4px',
                    backgroundColor: '#f3f3fe', border: '1px dashed #c3c6d7',
                    fontSize: '13px', fontWeight: 500, color: '#434655',
                  }}>+{insights.topSkills.length - 6} more</span>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#E2E8F0', marginBottom: '20px' }} />

          {/* Market Demand */}
          <div>
            <h3 style={{
              fontSize: '12px', fontWeight: 700, color: '#434655',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: '12px', margin: '0 0 12px 0',
            }}>
              MARKET DEMAND
            </h3>
            {insights.matchingOpportunities === null ? (
              <p style={{ fontSize: '13px', color: '#737686', lineHeight: 1.5, margin: 0 }}>
                Add a resume with listed skills to see how many open opportunities match.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '8px',
                  backgroundColor: insights.matchingOpportunities > 0 ? '#6df5e1' : '#E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px', color: insights.matchingOpportunities > 0 ? '#006f64' : '#737686' }}>
                    {insights.matchingOpportunities > 0 ? 'trending_up' : 'search_off'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#191b23' }}>
                    {insights.matchingOpportunities > 0 ? `${insights.matchingOpportunities} open role${insights.matchingOpportunities === 1 ? '' : 's'}` : 'No matches yet'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.4, marginTop: '2px' }}>
                    {insights.matchingOpportunities > 0
                      ? 'Currently open and tagged with your top skills.'
                      : 'None of your listed skills match an open opportunity right now.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ═══════════════════════════════════════════════════════════
        BOTTOM — History (two separate lists, never merged: an ATS
        check and an Optimiser run are different kinds of record with
        different reopen destinations)
        ═══════════════════════════════════════════════════════════ */}
    {(history.ats.length > 0 || history.optimizer.length > 0) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 14px 0' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#191b23', margin: 0 }}>ATS Score History</h2>
            <span style={{ fontSize: '11px', color: '#a3a6b8' }}>Last 6 saved</span>
          </div>
          <AtsHistoryList initialItems={history.ats} />
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 14px 0' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#191b23', margin: 0 }}>AI Optimizer History</h2>
            <span style={{ fontSize: '11px', color: '#a3a6b8' }}>Last 6 saved</span>
          </div>
          <OptimizerHistoryList initialItems={history.optimizer} />
        </div>
      </div>
    )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
