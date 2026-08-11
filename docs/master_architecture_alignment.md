# Opportunity Radar V2
# Master Architecture Alignment Document
**Role:** CTO + Principal Architect + Database Architect + AI Systems Architect
**Status:** FINAL — Single Source of Truth
**Version:** 1.0
**Date:** 2026-06-19

---

> This document supersedes any conflicting detail in TDD-001 through TDD-003.
> All future TDDs and implementation work must align to this document first.

---

## CHANGE 1: OPPORTUNITY SKILL EXTRACTION GOVERNANCE

### Problem

`opportunities.extracted_skills[]` is the foundational data asset that powers three critical systems: the Recommendation Engine, the ATS Engine, and the Resume Optimizer. Without traceability, we cannot know:
- Which opportunities were extracted with an old, less accurate prompt.
- Which opportunities failed extraction and need a retry.
- Whether a future extraction improvement (v2 prompt) should retroactively reprocess old records.

### Approved Database Changes

```sql
-- Add to existing opportunities table
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS skill_extraction_status  TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS skill_extraction_version TEXT;

-- Valid status values
-- 'pending'   → Not yet processed
-- 'processed' → Successfully extracted
-- 'failed'    → Extraction attempted and failed after all retries
-- 'skipped'   → Description too short; deterministic only

-- Valid version values
-- 'v1'        → Initial extraction (current prompt design)
-- 'v2'        → Future improved prompt (reserved)
-- 'v3'        → Reserved

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opp_extraction_status  ON opportunities(skill_extraction_status);
CREATE INDEX IF NOT EXISTS idx_opp_extraction_version ON opportunities(skill_extraction_version);
```

### Updated Opportunity Processing Lifecycle

```
NEW OPPORTUNITY INGESTED
  → skill_extraction_status = 'pending'
  → skill_extraction_version = null

EXTRACTION PIPELINE PICKS UP PENDING RECORDS
  → Phase 1 (deterministic): tags + skills column
  → Phase 2 (AI): Gemini Flash via AI Gateway (if Phase 1 yields < 5 skills)

SUCCESS:
  → extracted_skills = [...]
  → skill_extraction_status = 'processed'
  → skill_extraction_version = 'v1'
  → extraction_log row inserted

FAILURE (all retries exhausted):
  → extracted_skills = '{}'  (empty, not null)
  → skill_extraction_status = 'failed'
  → extraction_log row inserted with error_message

FUTURE RE-EXTRACTION (when v2 prompt ships):
  → Run migration: UPDATE opportunities SET skill_extraction_status = 'pending'
      WHERE skill_extraction_version = 'v1'
  → Pipeline reprocesses all v1 records
  → Successful records promoted to skill_extraction_version = 'v2'
```

### Governance Rule

The Recommendation Engine and ATS Engine MUST only use opportunities where `skill_extraction_status = 'processed'`. Opportunities with `pending` or `failed` status are included in the general feed but are excluded from personalised ranking logic (they receive a neutral score, not a zero score).

```sql
-- Filtering rule in get_ranked_opportunities RPC
WHERE o.status IN ('Published', 'Closing Soon')
  AND (o.deadline IS NULL OR o.deadline > NOW())
  -- Personalised scoring only for processed opportunities
  -- Unprocessed opportunities still appear but receive recency-only ranking
```

---

## CHANGE 2: RESUME PERFORMANCE OPTIMIZATION

### Problem

The current design stores all resume data in `resumes.parsed_data JSONB`. Every time the ATS Engine or Recommendation Engine needs the student's skills or project keywords, they must:
1. Fetch the entire JSONB blob (potentially several KB).
2. Parse the JSON in application code.
3. Flatten and normalise skills arrays on every request.

At 500 DAU each viewing 10 opportunities per session = 5,000 ATS computations per day, each requiring a JSONB parse. This is inefficient and adds unnecessary latency.

### Approved Database Changes

```sql
-- Add denormalised skill columns to resumes table
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS extracted_skills          TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_project_keywords TEXT[] DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resumes_extracted_skills
  ON resumes USING gin(extracted_skills);
CREATE INDEX IF NOT EXISTS idx_resumes_project_keywords
  ON resumes USING gin(extracted_project_keywords);
```

### Population Logic

These columns are populated at the moment a resume reaches `status = 'verified'` (i.e., the student clicks "Verify & Save" on the Resume Review Screen). This is a server-side operation in the `POST /api/resume/save` handler.

```typescript
// In POST /api/resume/save handler, after saving parsed_data:

function extractResumeSkills(parsedData: ResumeSchema): {
  skills: string[]
  projectKeywords: string[]
} {
  // Skills: directly from the skills array, normalised
  const skills = [...new Set(
    parsedData.skills.map(s => s.toLowerCase().trim())
  )].sort()

  // Project keywords: flatten all project.technologies arrays, deduplicate
  const projectKeywords = [...new Set(
    parsedData.projects
      .flatMap(p => p.technologies)
      .map(t => t.toLowerCase().trim())
      .filter(t => !skills.includes(t))  // Exclude already-captured skills
  )].sort()

  return { skills, projectKeywords }
}

// Write to resumes table
await supabase
  .from('resumes')
  .update({
    parsed_data: verifiedData,
    status: 'verified',
    extracted_skills: extracted.skills,
    extracted_project_keywords: extracted.projectKeywords,
    resume_updated_at: new Date().toISOString(),
  })
  .eq('id', resume_id)
```

### Updated ATS Engine Inputs

**Before this change:**
```typescript
// Had to fetch and parse full JSONB, then extract skills
const { parsed_data } = await fetchResume(userId)
const skills = parsed_data.skills.map(normalise)
const projectKeywords = parsed_data.projects.flatMap(p => p.technologies).map(normalise)
```

**After this change:**
```typescript
// Single column fetch — pre-normalised, ready to use
const { extracted_skills, extracted_project_keywords } = await fetchResumeSummary(userId)
// Zero parsing, zero flattening. Arrays are ready for intersection immediately.
```

### Updated `v_student_ats_inputs` View

```sql
CREATE OR REPLACE VIEW v_student_ats_inputs AS
SELECT
  p.id                              AS user_id,
  p.interests,
  r.id                              AS resume_id,
  r.extracted_skills,               -- ← NOW A DIRECT COLUMN, NOT JSONB PARSE
  r.extracted_project_keywords,     -- ← NOW A DIRECT COLUMN
  r.parsed_data -> 'experience'     AS experience_json,
  r.parsed_data -> 'education'      AS education_json,
  r.resume_updated_at
FROM profiles p
JOIN resumes r ON r.id = p.primary_resume_id
WHERE r.status = 'verified';
```

### Performance Impact

| Metric | Before | After |
| :--- | :--- | :--- |
| DB fetch size per ATS call | ~5–15 KB (full JSONB) | ~200 bytes (two arrays) |
| Application-layer parsing | Required (flatten + normalise) | None |
| Array overlap computation | After parsing | Immediately |
| GIN index usable? | No (JSONB) | Yes (native `text[]`) |

---

## CHANGE 3: AI GATEWAY ARCHITECTURE

### Problem

Without a centralised gateway, each AI-consuming feature would implement its own Gemini SDK call, timeout handling, retry logic, and error handling independently. This creates:
- Code duplication across Resume Parser, Resume Optimizer, Skill Extraction.
- No unified cost visibility.
- No single place to add Groq failover.
- Provider lock-in.

### Approved Architecture

```
ANY FEATURE NEEDING AI
        ↓
┌───────────────────────────────────────┐
│         AI GATEWAY LAYER              │
│  lib/ai-gateway/index.ts              │
│                                       │
│  1. Rate limit check                  │
│  2. Call Gemini Flash (timeout: 10s)  │
│  3. On fail: Retry Gemini (1x)        │
│  4. On fail: Call Groq (timeout: 8s)  │
│  5. On fail: Return AIError           │
│  6. Log result to ai_usage_log        │
└───────────────────────────────────────┘
        ↓                ↓
  [Gemini Flash]    [Groq Llama-3]
  (Primary)         (Fallback)
```

### Rule: No Direct Provider Calls

**REJECTED:**
```typescript
// ❌ NEVER DO THIS in any Route Handler or feature module
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const result = await genAI.generateContent(...)
```

**REQUIRED:**
```typescript
// ✅ ALWAYS USE THE GATEWAY
import { callAI } from '@/lib/ai-gateway'
const result = await callAI({ systemPrompt, userPrompt }, { feature: 'resume_optimizer', userId })
```

### Document Updates Required

| Document | Update Required |
| :--- | :--- |
| TDD-001 (Resume Parser) | Replace direct Gemini SDK call with `callAI()` from Gateway |
| TDD-004 (Resume Optimizer) | Already uses Gateway in approved design |
| TDD-006 (Skill Extraction) | Already uses Gateway in approved design |
| TDD-007 (AI Gateway) | Already the source of truth for Gateway design |

---

## CHANGE 4: PROVIDER STRATEGY

### Official Provider Role Assignment

| Provider | Model | Role | Features Using It |
| :--- | :--- | :--- | :--- |
| **Gemini Flash** | `gemini-1.5-flash` | Primary provider | Resume Parser, Resume Optimizer, Skill Extraction |
| **Groq** | `llama3-8b-8192` | Fallback provider | Same features, only when Gemini fails |

### Why Gemini Flash as Primary?

- Best instruction-following for structured JSON output (critical for Resume Parser).
- Fastest among quality models for short prompts (< 3s P50).
- Cheapest: $0.075/1M input tokens.
- `response_mime_type: "application/json"` mode eliminates JSON parse failures.

### Why Groq as Fallback?

- Different infrastructure stack from Gemini (true independence).
- Free tier covers MVP volumes.
- Extremely fast inference (200+ tokens/sec).
- Different failure modes than Gemini.

### Provider Failover Flow (Canonical)

```
REQUEST ENTERS GATEWAY
  ↓
CHECK RATE LIMIT
  → BLOCKED: Return 429 immediately
  → ALLOWED: Continue
  ↓
CALL GEMINI FLASH (timeout: 10s)
  → SUCCESS: Log + return result
  → FAIL (timeout or 5xx):
      ↓
    RETRY GEMINI ONCE (wait: 1s, timeout: 10s)
      → SUCCESS: Log + return result
      → FAIL:
          ↓
        CALL GROQ LLAMA-3 (timeout: 8s, no retry)
          → SUCCESS: Log provider='groq' + return result
          → FAIL:
              ↓
            LOG provider='all_failed'
            RETURN AIError { reason: 'all_failed' }
```

### Provider Abstraction Interface (Canonical)

```typescript
// This is the ONLY interface any consuming feature ever uses:
export interface AIRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number     // Default: 500
  temperature?: number   // Default: 0.3
  outputFormat?: 'text' | 'json'  // 'json' triggers Gemini JSON mode
}

export type AIResult = AIResponse | AIError
// AIResponse: { success: true, content, provider, tokensUsed, latencyMs }
// AIError:    { success: false, provider, reason, latencyMs }
```

---

## CHANGE 5: RESUME VERSIONING PREPARATION

### Architecture Note — NOT MVP

The Resume Optimizer (TDD-004) creates resume versions today via the `resume_versions` table. This section documents the canonical future state for a more complete versioning system.

**Current MVP State:**
- `resume_versions` table exists (TDD-004).
- Each optimizer session creates one version row.
- Versions are linked to a base `resumes.id`.

**Future Phase — Enhanced Versioning:**
```sql
-- Future schema (NOT to be implemented in MVP)
-- resume_versions is already created in TDD-004.
-- Future enhancements will add:

ALTER TABLE resume_versions
  ADD COLUMN version_number    INT NOT NULL DEFAULT 1,
  ADD COLUMN version_type      TEXT,  -- 'original' | 'optimized' | 'manual'
  ADD COLUMN parent_version_id UUID REFERENCES resume_versions(id);

-- This creates a tree structure:
-- original (v1)
--   └── optimized for Google SWE (v2)
--        └── manual edit (v3)
--   └── optimized for Amazon (v2b)
```

**When to implement:** Phase 2 — after Resume Optimizer has been live for 30+ days and usage data shows students creating multiple versions.

**Mark as:** `FUTURE PHASE — DO NOT BUILD IN MVP`

---

## CHANGE 6: BONUS SKILLS

### Problem

The current ATS Engine only answers: "What is the student missing?" It does not answer: "What extra value does the student bring?" A student with Kubernetes and AWS when the job only requires Python and SQL is a stronger candidate — but the current design doesn't surface this.

### Approved Logic Change (ATS Engine)

```typescript
// In lib/ats-engine.ts — Updated computeGapAnalysis()

function computeGapAnalysis(
  oppSkills: string[],
  studentSkills: string[],
  projectKeywords: string[]
): GapAnalysis {
  const allStudentSkills = new Set([...studentSkills, ...projectKeywords])
  const oppSkillSet = new Set(oppSkills)

  const matched_skills = studentSkills.filter(s => oppSkillSet.has(s))
  const project_matched_skills = projectKeywords.filter(s =>
    oppSkillSet.has(s) && !matched_skills.includes(s)
  )

  const missing_skills = oppSkills.filter(s => !allStudentSkills.has(s))

  // NEW: bonus_skills = student skills not required by the opportunity
  const bonus_skills = studentSkills.filter(s => !oppSkillSet.has(s))

  return {
    matched_skills,
    project_matched_skills,
    missing_skills,
    bonus_skills,    // ← NEW
    skill_coverage_pct: (matched_skills.length + project_matched_skills.length) / oppSkills.length * 100
  }
}
```

### Updated API Response (ATS Engine)

```json
{
  "ats_score": 72,
  "matched_skills": ["python", "sql"],
  "project_matched_skills": ["pandas"],
  "missing_skills": ["scikit-learn", "ml"],
  "bonus_skills": ["docker", "aws", "kubernetes"],
  "skill_coverage_pct": 60.0
}
```

### Updated ATS Center UI — Section 4.5 (New)

```
┌────────────────────────────────┐
│  ⭐ Your Bonus Skills          │
│                                │
│  [docker]  [aws]  [kubernetes] │  ← Gold/purple pills
│                                │
│  These skills aren't required  │
│  but strengthen your profile.  │
└────────────────────────────────┘
```

**Placement:** Between "Project Matches" and "Gap Analysis" sections.

### Bonus Skills in the Recommendation Engine

Bonus skills do NOT affect the Match Score. The score reflects fit, not surplus. However, the `bonus_skills[]` array is returned by the API and displayed in the "Improve Your Match" explanation section on the detail page to show the student their full competitive profile.

---

## CHANGE 7: SKILL IMPORTANCE RANKING

### Problem

"Missing Skills: [scikit-learn, ml, matplotlib, pandas, docker]" gives the student no guidance on which gap to close first. All skills appear equally important. A student who closes the `docker` gap (optional CI/CD tooling) instead of the `ml` gap (core to a Data Science role) has made a poor prioritisation decision.

### Approved Deterministic Ranking Strategy

**NO AI involved. This is a rule-based system.**

Importance is determined by a two-factor scoring function:

**Factor 1: Frequency Score (how often does this skill appear across all opportunities in our DB)**

```sql
-- Pre-computed during skill extraction and stored as a lookup
-- Run this query to generate frequency data:
SELECT
  unnest(extracted_skills) AS skill,
  COUNT(*) AS frequency
FROM opportunities
WHERE skill_extraction_status = 'processed'
GROUP BY skill
ORDER BY frequency DESC;
```

**Factor 2: Position Score (does this skill appear in the opportunity title or early in description)**

```typescript
function computePositionScore(skill: string, opp: Opportunity): number {
  const titleLower = opp.title.toLowerCase()
  const descLower = (opp.description ?? '').toLowerCase()
  const firstOccurrence = descLower.indexOf(skill)

  if (titleLower.includes(skill)) return 1.0          // In title = HIGH
  if (firstOccurrence < 200) return 0.7               // First 200 chars = MEDIUM-HIGH
  if (firstOccurrence < 500) return 0.4               // First 500 chars = MEDIUM
  return 0.2                                           // Buried deep = LOW
}
```

**Combined Importance Score:**
```
importance_score = (frequency_score * 0.6) + (position_score * 0.4)
```

**Tier Mapping:**
```
importance_score >= 0.7   → HIGH
importance_score >= 0.4   → MEDIUM
importance_score < 0.4    → LOW
```

### Implementation

A new table stores pre-computed skill frequency data:

```sql
CREATE TABLE skill_frequency_index (
  skill       TEXT PRIMARY KEY,
  frequency   INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rebuilt nightly via a scheduled background job (pg_cron or Inngest)
-- Simple query: SELECT unnest(extracted_skills), COUNT(*) FROM opportunities GROUP BY 1
```

The ATS Engine fetches the frequency score at analysis time via a lightweight lookup join on this table.

### Updated API Response

```json
{
  "missing_skills": [
    { "skill": "machine learning", "importance": "HIGH" },
    { "skill": "scikit-learn",     "importance": "MEDIUM" },
    { "skill": "docker",           "importance": "LOW" }
  ]
}
```

### Updated ATS Center UI — Section 3 (Modified)

```
┌──────────────────────────────────────────────┐
│  ❌ Missing Skills                            │
│                                              │
│  🔴 HIGH     [machine learning]              │
│  🟡 MEDIUM   [scikit-learn]                  │
│  🔵 LOW      [docker]                        │
│                                              │
│  Focus on HIGH priority skills first.        │
└──────────────────────────────────────────────┘
```

The Resume Optimizer's "Improve Your Match" deep-link pre-loads the `HIGH` importance missing skills first.

---

## CHANGE 8: MASTER DATA FLOW VALIDATION

### Complete Validated System Flow

```
STUDENT SIGNS UP
  ↓ profiles row created
  ↓ primary_resume_id = null

RESUME UPLOAD (TDD-001)
  ↓ PDF → Supabase Storage (bucket: 'resumes')
  ↓ resumes row created (status: 'uploaded')

RESUME PARSING (TDD-001, AI Gateway TDD-007)
  ↓ PDF text extracted (pdf-parse)
  ↓ callAI() → Gemini Flash → JSON
  ↓ Zod schema validation
  ↓ resumes.status = 'parsing' → 'review_required'
  ↓ resumes.parsed_data = { skills, projects, experience, education }

RESUME REVIEW (TDD-001)
  ↓ Student edits JSON on Review Screen
  ↓ POST /api/resume/save
  ↓ resumes.status = 'verified'
  ↓ resumes.extracted_skills = [normalised skills]         ← CHANGE 2
  ↓ resumes.extracted_project_keywords = [normalised kws]  ← CHANGE 2
  ↓ profiles.primary_resume_id = resumes.id

RECOMMENDATION ENGINE (TDD-002)
  ↓ Student opens /opportunities feed
  ↓ GET /api/opportunities/recommended
  ↓ Fetches student inputs from v_student_ats_inputs
    (reads extracted_skills, extracted_project_keywords directly — no JSONB parse)
  ↓ Calls get_ranked_opportunities(user_id) RPC
  ↓ PostgreSQL computes match_score for all 'processed' opportunities
  ↓ Returns ranked feed with match_score + matched_skills + missing_skills

ATS ENGINE (TDD-003)
  ↓ Student opens Opportunity Detail page
  ↓ GET /api/ats/analyze?opportunity_id=X
  ↓ Fetches student inputs from v_student_ats_inputs
  ↓ TypeScript intersection computation (< 1ms)
  ↓ Returns: ats_score, matched_skills, missing_skills (with importance), bonus_skills

RESUME OPTIMIZER (TDD-004)
  ↓ Student clicks "Improve Your Resume →"
  ↓ Deep-link: /resume/optimize?opportunity_id=X&missing_skills=ml,scikit-learn
  ↓ Student selects a bullet to improve
  ↓ POST /api/resume/optimize
  ↓ callAI() → Gemini Flash → 3 STAR-method alternatives
  ↓ Student selects one → POST /api/resume/save-version
  ↓ resume_versions row created (non-destructive)

APPLICATION TRACKER (TDD-005)
  ↓ Student clicks "Save" on opportunity card
  ↓ POST /api/tracker/save → applications row (stage: 'saved')
  ↓ Student clicks "Applied" → PATCH /api/tracker/:id/stage
  ↓ ats_score_snapshot captured from ATS Engine
  ↓ match_score_snapshot captured from Rec Engine cache
  ↓ application_events row logged
```

### Data Flow Inconsistencies Found & Corrected

| # | Inconsistency | Correction Applied |
| :--- | :--- | :--- |
| 1 | TDD-001 calls Gemini SDK directly | Updated to use `callAI()` from AI Gateway |
| 2 | ATS Engine fetched full `parsed_data` JSONB | Updated to use `extracted_skills` column |
| 3 | Rec Engine RPC fetched `parsed_data` JSONB | Updated view to use `extracted_skills` column |
| 4 | Missing skills had no priority/importance ranking | Added `skill_frequency_index` lookup in ATS Engine |
| 5 | No governance on `extracted_skills` staleness | Added `skill_extraction_status` + `version` columns |

### Security Flow Validation

| Step | Security Check | Status |
| :--- | :--- | :--- |
| Resume Upload | MIME type + magic bytes + 5MB limit | ✅ Covered in TDD-001 |
| Resume Parse | Rate limit (3/hour), JWT required | ✅ Covered in TDD-001 |
| ATS Analyze | JWT required, user_id from session | ✅ Covered in TDD-003 |
| Optimizer | JWT required, ownership check on resume_id | ✅ Covered in TDD-004 |
| Tracker | JWT required, RLS on applications table | ✅ Covered in TDD-005 |
| AI Gateway | API keys server-side only, never in client | ✅ Covered in TDD-007 |

---

## CHANGE 9: SCALABILITY REVIEW AT 500 DAU

### Assumptions

- 500 Daily Active Users (DAU)
- Each user views 10 opportunities per session
- Each user triggers 2 ATS analyses per session
- Each user makes 1 Resume Optimizer call per day
- Opportunities database: 5,000–10,000 records

### Database Load Analysis

| Operation | Requests/Day | DB Queries | Estimated DB Load |
| :--- | :--- | :--- | :--- |
| Recommendation Feed | 500 × 1 = 500 | 500 RPC calls (scoring 3,000 rows each) | Medium |
| ATS Analysis | 500 × 2 = 1,000 | 1,000 × 2 queries (student + opportunity) | Low |
| Opportunity Detail | 500 × 10 = 5,000 | 5,000 simple PK lookups | Very Low |
| Tracker Loads | 500 × 1 = 500 | 500 single-user queries | Very Low |
| **Total DB Queries/Day** | | **~8,000** | **Well within Supabase free tier** |

**Verdict:** Database load at 500 DAU is well within Supabase free tier limits (connection pool: 15 for free tier). No scaling action needed.

### AI Cost at 500 DAU

| Operation | Calls/Day | Tokens/Call | Daily Tokens | Daily Cost |
| :--- | :--- | :--- | :--- | :--- |
| Resume Parser | 10 (new signups) | 500 | 5,000 | $0.00038 |
| Resume Optimizer | 500 | 300 | 150,000 | $0.011 |
| Skill Extraction | 50 (new opps) | 350 | 17,500 | $0.0013 |
| **Total Daily AI Cost** | | | | **~$0.013** |
| **Monthly AI Cost** | | | | **~$0.39** |

**Verdict:** AI costs at 500 DAU are negligible (< $1/month). No cost concern.

### Identified Risks & Mitigations

| Risk | Severity | When | Mitigation |
| :--- | :--- | :--- | :--- |
| `get_ranked_opportunities` RPC slows down with 20,000+ opportunities | Medium | > 20,000 opps | Add `skill_extraction_status = 'processed'` filter (already designed). Consider materialized view. |
| Supabase connection pool saturation | Medium | > 2,000 DAU | Activate Supavisor (Supabase connection pooler, included in Pro plan). |
| Vercel function timeout on parse + AI call | Low | Now | Upgrade to Vercel Pro ($20/month) before launch. 30s limit instead of 10s. |
| Skill frequency index becomes stale | Low | After 30 days | Schedule nightly rebuild via pg_cron or a GitHub Actions scheduled workflow. |
| Groq free tier token limit exhausted | Low | > 1,000 DAU | Monitor monthly. Upgrade to Groq paid tier ($0.05/1M tokens). |

### Recommendations

1. **Before Launch:** Upgrade to Vercel Pro. The 10s function timeout on the free tier will break the resume parsing pipeline.
2. **At 1,000 DAU:** Activate `ats_cache` table (TDD-003). Serve cached ATS results instead of recomputing on every page view.
3. **At 2,000 DAU:** Move to Supabase Pro ($25/month) for larger connection pool + daily PITR backups.
4. **At 5,000 DAU:** Activate `user_opportunity_matches` cache table (TDD-002). Pre-compute match scores nightly.

---

## CHANGE 10: FINAL SOURCE OF TRUTH

### Approved Changes

| # | Change | Status |
| :--- | :--- | :--- |
| 1 | `skill_extraction_status` + `skill_extraction_version` governance fields on `opportunities` | ✅ APPROVED |
| 2 | `extracted_skills` + `extracted_project_keywords` denormalised columns on `resumes` | ✅ APPROVED |
| 3 | All AI calls routed through centralised AI Gateway | ✅ APPROVED (non-negotiable) |
| 4 | Gemini Flash as primary, Groq as fallback, for all features | ✅ APPROVED |
| 5 | `resume_versions` architecture documented as future phase | ✅ APPROVED (NOT MVP) |
| 6 | `bonus_skills[]` added to ATS Engine output and UI | ✅ APPROVED |
| 7 | Skill importance ranking (HIGH/MEDIUM/LOW) via `skill_frequency_index` | ✅ APPROVED |
| 8 | Master data flow validated, 5 inconsistencies corrected | ✅ APPROVED |
| 9 | Scalability review: no immediate action needed, upgrade path documented | ✅ APPROVED |

### Rejected Changes

| Change | Reason |
| :--- | :--- |
| Including `bonus_skills` in Match Score formula | Score reflects fit, not surplus. Adding bonus skills to scoring creates perverse incentives. |
| AI-based skill importance ranking | Non-deterministic. A rule-based frequency + position approach is sufficient and free. |
| Implementing `resume_versions` tree structure in MVP | Premature. Base `resume_versions` table in TDD-004 is sufficient. |
| Redis for rate limiting in MVP | Database-backed counter handles 500 DAU comfortably. Premature infrastructure cost. |

### Database Migration Summary

```sql
-- MIGRATION 1: Opportunity skill extraction governance
ALTER TABLE opportunities
  ADD COLUMN skill_extraction_status  TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN skill_extraction_version TEXT;
CREATE INDEX idx_opp_extraction_status  ON opportunities(skill_extraction_status);
CREATE INDEX idx_opp_extraction_version ON opportunities(skill_extraction_version);

-- MIGRATION 2: Resume denormalised skill columns
ALTER TABLE resumes
  ADD COLUMN extracted_skills           TEXT[] DEFAULT '{}',
  ADD COLUMN extracted_project_keywords TEXT[] DEFAULT '{}';
CREATE INDEX idx_resumes_extracted_skills   ON resumes USING gin(extracted_skills);
CREATE INDEX idx_resumes_project_keywords   ON resumes USING gin(extracted_project_keywords);

-- MIGRATION 3: Skill frequency index table
CREATE TABLE skill_frequency_index (
  skill      TEXT PRIMARY KEY,
  frequency  INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MIGRATION 4: All tables from TDD-004 through TDD-008
-- (resume_versions, optimizer_requests, applications, application_events,
--  extraction_log, ai_usage_log) — as defined in their respective TDDs.
```

### API Changes Summary

| API | Change |
| :--- | :--- |
| `POST /api/resume/save` | Now also writes `extracted_skills` and `extracted_project_keywords` |
| `GET /api/ats/analyze` | Response now includes `bonus_skills[]` and `missing_skills` as `[{skill, importance}]` objects |
| `GET /api/opportunities/recommended` | Filters to `skill_extraction_status = 'processed'` for personalised ranking |
| All AI-calling routes | Must use `callAI()` from `lib/ai-gateway`. Direct Gemini SDK calls are prohibited. |

### Architecture Changes Summary

| Component | Change |
| :--- | :--- |
| Resume Parser | Routes through AI Gateway. Uses Gemini JSON mode for structured output. |
| ATS Engine | Reads `extracted_skills`/`extracted_project_keywords` columns directly (no JSONB parse). Returns `bonus_skills[]` and importance-ranked `missing_skills[]`. |
| Recommendation Engine | `v_student_ats_inputs` view now uses denormalised columns. Personalised ranking filters to `skill_extraction_status = 'processed'`. |
| AI Gateway | Centralised. Mandatory for all AI calls. Gemini primary, Groq fallback. |
| Skill Extraction Pipeline | Sets `skill_extraction_status` and `skill_extraction_version` on every opportunity. |

### Final MVP Scope (Definitive)

1. ✅ Resume Upload + Storage
2. ✅ Resume Parser (Gemini Flash via AI Gateway)
3. ✅ Resume Review Screen (Human-in-the-loop verification)
4. ✅ Recommendation Engine (Deterministic PostgreSQL scoring)
5. ✅ Match Score Engine (6-component weighted formula)
6. ✅ ATS Engine (Deterministic TypeScript computation + bonus skills + importance ranking)
7. ✅ Resume Optimizer (Gemini Flash via AI Gateway, 3 STAR alternatives)
8. ✅ Enhanced Application Tracker (5-stage Kanban + score snapshots)
9. ✅ Skill Extraction Pipeline (Background; deterministic Phase 1 + AI Phase 2)
10. ✅ AI Gateway Layer (Centralised; Gemini + Groq failover)
11. ✅ Production Infrastructure (Vercel + Supabase + Sentry + CI/CD)

### Future Phase Scope (Explicitly Excluded from MVP)

| Feature | Why Excluded |
| :--- | :--- |
| Voice Interview Simulator | Too complex, too expensive, not core to immediate student value |
| Text Interview Simulator | Out of MVP per FRS |
| Chrome Extension | Separate product surface |
| Career Health Score | Requires 90+ days of data to be meaningful |
| Placement Readiness Score | Requires institutional data (university placements) |
| Dean's Placement Dashboard | B2B feature; requires institutional relationship |
| Career Roadmap | Requires content investment beyond engineering |
| Recruiter Marketplace | Requires recruiter supply side |
| Social Features | Out of scope |
| Enhanced `resume_versions` tree structure | Phase 2 after Optimizer usage data collected |
| Semantic search / vector embeddings | Explicitly rejected |
| Redis caching | Not needed until 2,000+ DAU |
| `user_opportunity_matches` cache activation | Not needed until 5,000+ DAU |

---

## CTO FINAL VERDICT

The Opportunity Radar V2 architecture as defined across TDD-001 through TDD-008, with the 10 alignment changes applied in this document, is **approved for implementation**.

**The architecture is:**
- ✅ **Simple enough** for a student team to build in 8–10 weeks.
- ✅ **Reliable enough** for production with 500 DAU.
- ✅ **Scalable enough** to reach 5,000 DAU without architectural changes.
- ✅ **Cheap enough** to run at < $30/month in infrastructure costs.
- ✅ **Maintainable enough** that a single engineer can own any subsystem.

**The three non-negotiable rules are:**
1. All AI calls go through the AI Gateway. Zero exceptions.
2. ATS scoring is deterministic. Zero AI in the scoring pipeline.
3. Resume optimisation is non-destructive. Original is always preserved.

**Begin implementation in this order:**

```
Week 1:  TDD-007 AI Gateway + TDD-008 Infrastructure setup
Week 2:  Database migrations (all 4 migration groups)
Week 2:  TDD-006 Skill Extraction + backfill (must complete before Rec Engine)
Week 3:  TDD-001 Resume Parser pipeline
Week 3:  TDD-002 Recommendation Engine
Week 4:  TDD-003 ATS Engine (including bonus_skills + importance ranking)
Week 5:  TDD-004 Resume Optimizer
Week 6:  TDD-005 Application Tracker
Week 7:  Integration testing + edge case hardening
Week 8:  Production deployment + monitoring setup
```

**This document is now the single source of truth for Opportunity Radar V2.**
