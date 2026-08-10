import React from 'react';
import Link from 'next/link';
import { listResumes } from '@/features/resume-toolkit/services/resume-actions';
import { ResumeListClient } from '@/features/resume-toolkit/components/resume-list-client';

export default async function ResumeToolkitPrototype() {
  const result = await listResumes();
  const resumes = result.success ? result.resumes : [];

  return (
    <div className="flex w-full gap-8 font-sans items-start" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ═══════════════════════════════════════════════════════════
          LEFT COLUMN — Workspace Tools
          ═══════════════════════════════════════════════════════════ */}
      <div className="w-[280px] shrink-0 flex flex-col gap-4">
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
            description to produce anything honest. */}
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
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT COLUMN — Career Insights
          ═══════════════════════════════════════════════════════════ */}
      <div className="shrink-0" style={{ width: '280px' }}>
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

          {/* Resume Strength */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#434655', lineHeight: 1.3 }}>
                Resume<br />Strength
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#004ac6', lineHeight: 1.3, textAlign: 'right' }}>
                +12% this<br />month
              </span>
            </div>

            {/* Bar chart */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              height: '100px', gap: '6px',
              paddingBottom: '8px',
              borderBottom: '1px solid #E2E8F0',
            }}>
              <div style={{ flex: 1, backgroundColor: '#dbe1ff', height: '35%', borderRadius: '2px 2px 0 0' }} />
              <div style={{ flex: 1, backgroundColor: '#dbe1ff', height: '45%', borderRadius: '2px 2px 0 0' }} />
              <div style={{ flex: 1, backgroundColor: '#b4c5ff', height: '55%', borderRadius: '2px 2px 0 0' }} />
              <div style={{ flex: 1, backgroundColor: '#004ac6', height: '80%', borderRadius: '2px 2px 0 0' }} />
              <div style={{ flex: 1, backgroundColor: '#004ac6', height: '95%', borderRadius: '2px 2px 0 0' }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: '6px',
              fontSize: '11px', fontWeight: 700, color: '#737686',
              textTransform: 'uppercase', letterSpacing: '0.01em',
            }}>
              <span>MAR</span>
              <span>APR</span>
              <span>MAY</span>
            </div>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{
                padding: '5px 10px', borderRadius: '4px',
                backgroundColor: '#ededf9',
                fontSize: '13px', fontWeight: 500, color: '#191b23',
              }}>React.js</span>
              <span style={{
                padding: '5px 10px', borderRadius: '4px',
                backgroundColor: '#ededf9',
                fontSize: '13px', fontWeight: 500, color: '#191b23',
              }}>UX Design</span>
              <span style={{
                padding: '5px 10px', borderRadius: '4px',
                backgroundColor: '#ededf9',
                fontSize: '13px', fontWeight: 500, color: '#191b23',
              }}>Typescript</span>
              <span style={{
                padding: '5px 10px', borderRadius: '4px',
                backgroundColor: '#ededf9',
                fontSize: '13px', fontWeight: 500, color: '#191b23',
              }}>Figma</span>
              <span style={{
                padding: '5px 10px', borderRadius: '4px',
                backgroundColor: '#f3f3fe', border: '1px dashed #c3c6d7',
                fontSize: '13px', fontWeight: 500, color: '#434655',
              }}>+4 more</span>
            </div>
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '8px',
                backgroundColor: '#6df5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#006f64' }}>trending_up</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#191b23' }}>High Demand</span>
                <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.4, marginTop: '2px' }}>
                  342 active roles match your profile.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
