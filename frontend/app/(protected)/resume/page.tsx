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

        {/* Card 4: AI Optimizer (Active — dashed selection border) */}
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
              Smart enhancement suggestions based on your target role.
            </span>
          </div>
        </div>

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

        {/* Main Card */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>

          {/* Stepper Row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: '#004ac6', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                }}>1</div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#004ac6' }}>Analysis</span>
              </div>
              {/* Connector line */}
              <div style={{ width: '32px', height: '2px', backgroundColor: '#E2E8F0' }} />
              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: '#E2E8F0', color: '#191b23',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                }}>2</div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#191b23' }}>Optimization</span>
              </div>
            </div>
            {/* Last saved */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              color: '#004ac6', fontSize: '13px', fontWeight: 600,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
              Last saved 2m ago
            </div>
          </div>

          {/* Content grid: ATS Score + Critical Gaps */}
          <div style={{ padding: '24px', display: 'flex', gap: '24px' }}>

            {/* ATS Score Donut */}
            <div style={{
              width: '190px', flexShrink: 0,
              border: '1px solid #e1e2ed', backgroundColor: '#f3f3fe',
              borderRadius: '12px', padding: '24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center',
            }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '16px' }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="50" cy="50" r="40" stroke="#E2E8F0" strokeWidth="9" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke="#004ac6"
                    strokeWidth="9"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset="80.38"
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '36px', fontWeight: 700, color: '#191b23', letterSpacing: '-0.02em', lineHeight: 1 }}>68</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#434655', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>ATS SCORE</span>
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#434655', fontWeight: 500, lineHeight: 1.4, margin: 0, padding: '0 8px' }}>
                Improve your score to 85+ for best results
              </p>
            </div>

            {/* Critical Gaps */}
            <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#191b23', marginBottom: '16px', margin: '0 0 16px 0' }}>
                Critical Gaps
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Gap 1: Red — Missing Action Verbs */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px', borderRadius: '8px',
                  backgroundColor: '#ffdad6', border: '1px solid #ffdad6',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ba1a1a', marginTop: '1px' }}>warning</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ba1a1a' }}>Missing Action Verbs</span>
                    <span style={{ fontSize: '13px', color: '#ba1a1a', lineHeight: 1.4, marginTop: '2px' }}>
                      Use words like &quot;Orchestrated&quot;, &quot;Developed&quot;, or &quot;Initiated&quot;.
                    </span>
                  </div>
                </div>

                {/* Gap 2: Orange — Quantifiable Results */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px', borderRadius: '8px',
                  backgroundColor: '#bc4800', border: '1px solid #bc4800',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffffff', marginTop: '1px' }}>lightbulb</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Quantifiable Results</span>
                    <span style={{ fontSize: '13px', color: '#ffede6', lineHeight: 1.4, marginTop: '2px' }}>
                      Add metrics (%, $, numbers) to your achievements.
                    </span>
                  </div>
                </div>

                {/* Gap 3: Gray — Skills Alignment */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px', borderRadius: '8px',
                  backgroundColor: '#ededf9', border: '1px solid #e1e2ed',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#434655', marginTop: '1px' }}>search</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#191b23' }}>Skills Alignment</span>
                    <span style={{ fontSize: '13px', color: '#434655', lineHeight: 1.4, marginTop: '2px' }}>
                      Python and Cloud Architecture keys not detected.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generated Result Preview */}
          <div style={{ padding: '8px 24px 24px 24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#191b23', marginBottom: '16px', margin: '0 0 16px 0' }}>
              Generated Result Preview
            </h3>

            <div style={{
              backgroundColor: '#ffffff', border: '1px solid #E2E8F0',
              borderRadius: '12px', padding: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: '280px', position: 'relative',
            }}>
              {/* Placeholder resume skeleton */}
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', opacity: 0.6 }}>
                <div style={{ width: '180px', height: '24px', backgroundColor: '#f3f3fe', borderRadius: '4px' }} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '12px', backgroundColor: '#f3f3fe', borderRadius: '4px' }} />
                  <div style={{ width: '80%', height: '12px', backgroundColor: '#f3f3fe', borderRadius: '4px' }} />
                  <div style={{ width: '90%', height: '12px', backgroundColor: '#f3f3fe', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                position: 'absolute', bottom: '24px', left: '24px', right: '24px',
                display: 'flex', gap: '16px',
              }}>
                <button style={{
                  flex: 1, height: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  borderRadius: '8px', border: '1px solid #E2E8F0',
                  backgroundColor: '#ffffff', color: '#191b23',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>visibility</span>
                  Preview Full
                </button>
                <button style={{
                  flex: 1, height: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  borderRadius: '8px', border: 'none',
                  backgroundColor: '#004ac6', color: '#ffffff',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>auto_fix_high</span>
                  Apply All AI Fixes
                </button>
              </div>
            </div>
          </div>
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
