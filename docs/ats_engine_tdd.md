# Technical Design Document (TDD)
**Feature:** ATS Engine — Gap Analysis System
**Project:** Opportunity Radar V2
**Stack:** Next.js 16, TypeScript, Tailwind, Supabase PostgreSQL
**Constraint:** Deterministic only. No AI in ATS scoring pipeline.
**Version:** 1.0

---

## SECTION 1: FEATURE OVERVIEW

### Purpose

When a student opens any opportunity on Opportunity Radar, the ATS Engine instantly computes and displays a complete, explainable analysis of how well their verified resume matches that specific opportunity. This analysis includes a numerical ATS Score, a categorised breakdown of matched and missing skills, project keyword coverage, and an "Improvement Score" showing what the score could be if gaps were addressed.

The ATS Engine is the analytical core that feeds both the Recommendation Engine (for feed ranking) and the Resume Optimizer (for targeted improvement suggestions). It must be fast, cheap, and completely deterministic — every student running the same resume against the same opportunity must always get the same result.

### User Flow

1. Student has a verified resume (`resumes.status = 'verified'`).
2. Student clicks on any opportunity card in the feed.
3. The Opportunity Detail page loads.
4. The ATS Engine API is called in parallel with the opportunity data fetch.
5. The "ATS Center" panel renders on the right side of the detail page.
6. Student sees: ATS Score, Matched Skills, Missing Skills, Project Matches, Gap Analysis, Improvement Score.
7. Student clicks "Improve Your Resume →" and is taken to the Resume Optimizer pre-loaded with the missing skill list.

### Business Value

* Differentiates Opportunity Radar from generic job boards that show no personalisation on the detail page.
* Creates a natural entry point into the Resume Optimizer (conversion funnel: View → Analyse → Improve).
* Produces concrete, shareable metrics for university placement officers ("Students who use ATS Engine improve application quality by X%").

### Student Value

* Instantly know whether to apply before investing time in a cover letter.
* Know exactly what skills to add to their resume to become a stronger candidate.
* See that projects count — not just formal work experience.

### Success Criteria

* ATS analysis renders in < 300ms after the opportunity detail page loads.
* ATS Score is deterministic: same resume + same opportunity = same score, always.
* Missing Skills list matches exactly what an ATS parser would flag (keyword intersection).
* Improvement Score calculation is accurate and explained in plain English.

### Failure Criteria

* ATS Score differs between two identical requests for the same user and opportunity.
* The engine makes an AI API call on every opportunity view (cost blowout risk).
* Missing skills list is empty for an opportunity that clearly requires skills the student does not have.

---

## SECTION 2: ATS ENGINE DESIGN

### Complete ATS Workflow

```
INPUT
├── Verified Resume (from resumes.parsed_data)
│   ├── skills[]
│   ├── projects[].technologies[]
│   ├── experience[].bullets[]
│   └── education[].degree
│
└── Opportunity (from opportunities table)
    ├── extracted_skills[]
    ├── experience_level
    ├── category
    └── title + description

         ↓
┌──────────────────────────────┐
│  NORMALISATION LAYER         │
│  - Lowercase all arrays      │
│  - Deduplicate               │
│  - Trim whitespace           │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  INTERSECTION COMPUTATION    │
│  - matched_skills            │
│  - project_matched_skills    │
│  - missing_skills            │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  COMPONENT SCORING           │
│  - skill_score               │
│  - project_score             │
│  - experience_score          │
│  - education_score           │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  WEIGHTED AGGREGATION        │
│  → ATS Score 0–100           │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  GAP ANALYSIS                │
│  - Skill gaps                │
│  - Project gaps              │
│  - Experience gaps           │
│  - Education gaps            │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  IMPROVEMENT SCORE           │
│  - Simulated perfect match   │
│  - potential_score           │
└──────────────────────────────┘

OUTPUT
├── ats_score: int (0–100)
├── matched_skills: string[]
├── project_matched_skills: string[]
├── missing_skills: string[]
├── skill_coverage_pct: float
├── experience_match: bool
├── education_match: bool
├── gap_analysis: GapAnalysis object
└── improvement_score: int (0–100)
```

---

## SECTION 3: ATS SCORING SYSTEM

### ATS Score Formula (Deterministic, 0–100)

```
ATS_SCORE = (
  skill_score       * 0.55 +
  project_score     * 0.15 +
  experience_score  * 0.20 +
  education_score   * 0.10
) * 100
```

**Why these weights?**

| Component | Weight | Rationale |
| :--- | :--- | :--- |
| Skills | 55% | ATS scanners primarily keyword-match against explicit skill lists. This is the single strongest signal of job fit. |
| Experience | 20% | Seniority level is frequently a hard filter in real ATS systems. A fresher applying for a senior role will be auto-rejected. |
| Projects | 15% | For student profiles, projects are the most credible substitute for work experience. Higher than typical ATS weight to compensate for thin experience sections. |
| Education | 10% | Degree requirements are present in a minority of opportunities. When they apply, they matter. When they don't, this component defaults to a neutral score. |

---

### Component Calculations

**1. `skill_score` (0.0 to 1.0)**

```
-- Normalisation
student_skills_normalised = DISTINCT LOWER(s) FOR s IN student.skills

-- Intersection
matched = student_skills_normalised ∩ opp.extracted_skills
total   = ARRAY_LENGTH(opp.extracted_skills)

IF total = 0:
  skill_score = 0.5   -- No required skills defined; neutral pass
ELSE:
  skill_score = LEAST(COUNT(matched) / total, 1.0)
```

*Example:*
- Opportunity requires: `[python, sql, pandas, matplotlib, scikit-learn]` (5 skills)
- Student has: `[python, sql, java]`
- matched = 2, skill_score = 2/5 = 0.40

---

**2. `project_score` (0.0 to 1.0)**

```
-- Extract all project technologies, flatten, deduplicate, normalise
project_keywords = DISTINCT LOWER(t)
  FOR project IN student.projects
    FOR t IN project.technologies

-- Intersection (exclude already-matched skills to avoid double counting)
project_only_keywords = project_keywords - matched_skills
project_matched = project_only_keywords ∩ opp.extracted_skills

total = ARRAY_LENGTH(opp.extracted_skills)

IF total = 0:
  project_score = 0.5
ELSE:
  project_score = LEAST(COUNT(project_matched) / total, 1.0)
```

*Example:*
- Opportunity requires: `[react, typescript, node.js, docker]`
- Student skills: `[react]` → matched_skills = [react]
- Student projects used: `[react, typescript, express]`
- project_only_keywords = `[typescript, express]`
- project_matched = `[typescript]` (1 of 4)
- project_score = 1/4 = 0.25

---

**3. `experience_score` (0.0 to 1.0)**

```
-- Derive student years of experience
work_entries = student.experience[]
student_years = SUM(months_between(entry.start_date, entry.end_date OR NOW())) / 12

-- Map to level
IF student_years = 0:           student_level = 'Fresher'
IF student_years <= 2:          student_level = 'Undergrad'
IF student_years > 2:           student_level = 'Experienced'

-- Score against opportunity requirement
IF opp.experience_level = 'Any':                              experience_score = 1.0
IF opp.experience_level = student_level:                      experience_score = 1.0
IF opp.experience_level = 'Fresher' AND student_level != 'Fresher': experience_score = 0.7
  -- Overqualified is not penalised heavily
IF opp.experience_level = 'Senior' AND student_level = 'Fresher':   experience_score = 0.2
  -- Significant mismatch; honest penalty
ELSE: experience_score = 0.5
```

---

**4. `education_score` (0.0 to 1.0)**

```
-- Extract highest degree
student_degree = MAX(education[].degree) by rank:
  Rank: Doctorate > Masters > Bachelors > Diploma > Other

-- Map opportunity requirement (parsed from experience_level or description)
IF opp requires 'Masters' AND student_degree >= 'Masters':  education_score = 1.0
IF opp requires 'Bachelors' AND student_degree >= 'Bachelors': education_score = 1.0
IF opp.experience_level = 'Any' OR no degree requirement:   education_score = 1.0
  -- Most internships and junior roles have no hard degree filter
ELSE: education_score = 0.5
```

---

### Full Worked Example

**Student Profile:**
- Skills: `[python, sql, react]`
- Projects: `[python, pandas, matplotlib]`
- Experience: 0 years (fresher)
- Education: B.Tech (Bachelors)

**Opportunity:** Data Science Internship
- extracted_skills: `[python, sql, pandas, scikit-learn, ml]`
- experience_level: `Fresher`

**Computation:**
- matched_skills = `[python, sql]` → skill_score = 2/5 = 0.40
- project_matched = `[pandas]` → project_score = 1/5 = 0.20
- experience_score = 1.0 (Fresher matches Fresher)
- education_score = 1.0 (no degree requirement)

**ATS Score:**
```
= (0.40 × 0.55) + (0.20 × 0.15) + (1.0 × 0.20) + (1.0 × 0.10)
= 0.22 + 0.03 + 0.20 + 0.10
= 0.55 × 100
= 55
```

**Missing Skills:** `[scikit-learn, ml]`
**Skill Coverage:** 60% (3 of 5 skills covered by skills + projects)

---

## SECTION 4: GAP ANALYSIS ENGINE

The Gap Analysis Engine is a structured decomposition of the match result into actionable categories. It answers: "What specifically is stopping this student from being a stronger candidate?"

### 1. Skill Gap

```
missing_skills = opp.extracted_skills
  - student_skills_normalised
  - project_keywords_normalised

skill_coverage_pct = (COUNT(matched_skills) + COUNT(project_matched)) / total_opp_skills × 100
```

Output:
```json
{
  "matched_skills": ["python", "sql"],
  "project_matched_skills": ["pandas"],
  "missing_skills": ["scikit-learn", "ml"],
  "skill_coverage_pct": 60.0
}
```

### 2. Project Gap

Identifies opportunity skills that appear in neither the student's skill list nor their project technologies.

```
project_gap = missing_skills - project_keywords
```

Interpretation: If `project_gap` is non-empty, the recommendation is: "Consider building a project using: scikit-learn, ml."

### 3. Experience Gap

```
IF experience_score < 1.0:
  experience_gap = {
    "required": opp.experience_level,
    "student_has": student_level,
    "gap": "You have X years; this role expects Y"
  }
ELSE:
  experience_gap = null
```

### 4. Education Gap

```
IF education_score < 1.0:
  education_gap = {
    "required": opp_degree_requirement,
    "student_has": student_degree,
    "gap": "This role requires a Masters degree"
  }
ELSE:
  education_gap = null
```

### Full Gap Analysis Output Example

```json
{
  "ats_score": 55,
  "skill_coverage_pct": 60.0,
  "matched_skills": ["python", "sql"],
  "project_matched_skills": ["pandas"],
  "missing_skills": ["scikit-learn", "ml"],
  "project_gap": ["scikit-learn", "ml"],
  "experience_gap": null,
  "education_gap": null,
  "improvement_suggestions": [
    "Add 'scikit-learn' to your resume skills or a project.",
    "Add 'ml' (Machine Learning) as a listed skill or project technology.",
    "Your experience level is a perfect match — no changes needed.",
    "Build a project using scikit-learn to demonstrate applied ML skills."
  ]
}
```

---

## SECTION 5: DATABASE DESIGN

### Principle: Reuse, Don't Duplicate

All data required by the ATS Engine already exists in tables designed by the Resume Parser TDD and Recommendation Engine TDD. No new tables are required for MVP. The following reviews confirm which columns are already present and what (minimal) additions are needed.

---

### `opportunities` Table Review

| Column | Status | Notes |
| :--- | :--- | :--- |
| `extracted_skills TEXT[]` | Required (from Rec Engine TDD) | Primary comparison array. Must be backfilled. |
| `experience_level TEXT` | Already exists | Used for experience_score. |
| `category TEXT` | Already exists | Used for category context. |
| `title TEXT` | Already exists | Displayed in ATS Center UI. |
| `description TEXT` | Already exists | Not directly scored. Available for future text analysis. |

**No new columns needed on `opportunities`.**

---

### `resumes` Table Review

| Column | Status | Notes |
| :--- | :--- | :--- |
| `parsed_data JSONB` | Already exists | Contains skills[], projects[], experience[], education[]. |
| `status resume_status` | Already exists | Only `verified` resumes are used. |
| `resume_updated_at TIMESTAMPTZ` | Added in Rec Engine TDD | Tracks freshness. Not scored in MVP. |

**No new columns needed on `resumes`.**

---

### `profiles` Table Review

| Column | Status | Notes |
| :--- | :--- | :--- |
| `primary_resume_id UUID` | Required (from Resume Parser TDD) | Must point to the verified resume. |
| `interests TEXT[]` | Already exists | Not used by ATS Engine directly. |

**No new columns needed on `profiles`.**

---

### Optional: `ats_cache` Table (NOT required for MVP)

```sql
-- Future only. Cache ATS results to avoid recomputation on every page view.
CREATE TABLE ats_cache (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  ats_score       INT NOT NULL,
  result_json     JSONB NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, opportunity_id)
);
CREATE INDEX idx_ats_cache_user ON ats_cache(user_id, computed_at DESC);
```

**When to activate:** When p95 latency of `/api/ats/analyze` exceeds 500ms due to dataset growth.

---

### Recommended View: `v_student_ats_inputs`

A lightweight, materialised-on-demand view for fetching all student inputs in a single query:

```sql
CREATE OR REPLACE VIEW v_student_ats_inputs AS
SELECT
  p.id                                  AS user_id,
  r.parsed_data -> 'skills'             AS skills_json,
  r.parsed_data -> 'projects'           AS projects_json,
  r.parsed_data -> 'experience'         AS experience_json,
  r.parsed_data -> 'education'          AS education_json
FROM profiles p
JOIN resumes r ON r.id = p.primary_resume_id
WHERE r.status = 'verified';
```

---

## SECTION 6: API DESIGN

### `GET /api/ats/analyze`

**Purpose:** Returns the complete ATS analysis for a specific student-opportunity pair.

**Authentication:** Required. Uses Supabase JWT session. `user_id` is extracted server-side from the session — never passed as a client parameter.

**Request:**
```
GET /api/ats/analyze?opportunity_id=<uuid>
Authorization: Bearer <supabase_jwt>
```

**Processing:**
1. Extract `user_id` from session.
2. Fetch student inputs from `v_student_ats_inputs` (single query).
3. Fetch opportunity `extracted_skills`, `experience_level`, `category` (single query).
4. Run deterministic ATS computation in TypeScript on the server (not in DB — this is application-layer math, not DB-layer scoring, keeping the stored procedure lean).
5. Return structured JSON.

> **Architecture Note:** Unlike the Recommendation Engine (which scores 3,000 rows and must run in PostgreSQL), the ATS Engine scores exactly ONE opportunity against ONE resume. This is trivial computation (~0.1ms). It runs cleanly in the Next.js Route Handler without needing an RPC.

**Response (200 OK):**
```json
{
  "ats_score": 55,
  "skill_coverage_pct": 60.0,
  "matched_skills": ["python", "sql"],
  "project_matched_skills": ["pandas"],
  "missing_skills": ["scikit-learn", "ml"],
  "experience_match": true,
  "education_match": true,
  "gap_analysis": {
    "skill_gap": ["scikit-learn", "ml"],
    "project_gap": ["scikit-learn", "ml"],
    "experience_gap": null,
    "education_gap": null
  },
  "improvement_score": 95,
  "improvement_suggestions": [
    "Add 'scikit-learn' to your resume skills or a project.",
    "Add 'ml' as a listed skill or project technology."
  ],
  "resume_freshness": "fresh"
}
```

**Response (200 OK, no resume):**
```json
{
  "ats_score": null,
  "fallback": true,
  "message": "Upload and verify your resume to see your ATS score."
}
```

**Errors:**
- `401 Unauthorized` — No valid session.
- `404 Not Found` — Opportunity does not exist.
- `422 Unprocessable Entity` — `opportunity_id` param missing or invalid UUID.

**Caching:**
- Client-side: Cache response in React Query / SWR with `staleTime: 5 minutes`. ATS scores don't change unless the student updates their resume or a new opportunity version is ingested.
- Server-side: No server cache for MVP. Activate `ats_cache` table when needed at scale.

**Rate Limiting:**
- 60 requests per user per hour. ATS is a read-only compute operation, but must be protected against scraping.

---

## SECTION 7: ATS CENTER UI

### Opportunity Detail Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  OPPORTUNITY DETAIL                                             │
│  ┌──────────────────────────────┐  ┌────────────────────────┐  │
│  │  Job Header                  │  │  ATS CENTER PANEL      │  │
│  │  Company + Title + Location  │  │  (Right Column)        │  │
│  │  Tags + Deadline             │  │                        │  │
│  │                              │  │  1. ATS Score Card     │  │
│  │  Job Description             │  │  2. Matched Skills     │  │
│  │  (full text)                 │  │  3. Missing Skills     │  │
│  │                              │  │  4. Project Matches    │  │
│  │  [Apply Now Button]          │  │  5. Gap Analysis       │  │
│  │                              │  │  6. Improve Score      │  │
│  └──────────────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### ATS Center Panel — Section-by-Section

**Section 1: ATS Score Card**
```
┌────────────────────────────────┐
│  Your ATS Score                │
│                                │
│        [ 55 ]                  │  ← Large score number, coloured ring
│      Good Match                │  ← Contextual label
│                                │
│  Skill Coverage: 60%           │
│  ████████░░  3 of 5 skills     │  ← Progress bar
└────────────────────────────────┘
```

Score label tiers:
- 80–100: "Excellent Match" (Green)
- 60–79: "Good Match" (Amber)
- 40–59: "Partial Match" (Orange)
- 0–39: "Low Match" (Red)

---

**Section 2: Matched Skills**
```
┌────────────────────────────────┐
│  ✅ Matched Skills             │
│                                │
│  [python]  [sql]               │  ← Green pills
└────────────────────────────────┘
```

---

**Section 3: Missing Skills**
```
┌────────────────────────────────┐
│  ❌ Missing Skills             │
│                                │
│  [scikit-learn]  [ml]          │  ← Red pills
└────────────────────────────────┘
```

---

**Section 4: Project Matches**
```
┌────────────────────────────────┐
│  🔵 Matched from Projects      │
│                                │
│  [pandas]                      │  ← Blue pills
│                                │
│  ℹ️ These came from your       │
│     project work, not skills.  │
└────────────────────────────────┘
```

---

**Section 5: Gap Analysis**
```
┌────────────────────────────────┐
│  📊 Gap Analysis               │
│                                │
│  Experience Level              │
│  ✅ Match (Fresher required)   │
│                                │
│  Education                     │
│  ✅ No degree requirement      │
│                                │
│  Skills Gap                    │
│  Add: scikit-learn, ml         │
└────────────────────────────────┘
```

---

**Section 6: Improve Your Match**
```
┌────────────────────────────────┐
│  🚀 Improve Your Match         │
│                                │
│  Current Score:     55         │
│  Potential Score:   95         │
│                                │
│  Add these skills to           │
│  reach 95%:                    │
│                                │
│  • scikit-learn                │
│  • ml                          │
│                                │
│  [Improve Your Resume →]       │
└────────────────────────────────┘
```

---

### Component States

| State | UI Behaviour |
| :--- | :--- |
| Loading | Skeleton cards for each section |
| No Resume | Replace entire panel with: "Upload resume to see ATS score" CTA |
| Low ATS Score (< 40) | Score ring is red; add banner: "This role may be a stretch — consider applying after improving skills." |
| Perfect Match (100) | Confetti animation trigger (micro-interaction). Message: "Perfect match! Apply now." |
| Opportunity has no skills | Score ring is grey; message: "This opportunity has no listed skill requirements." |

---

## SECTION 8: IMPROVEMENT SCORE

### Purpose

Show the student what their ATS Score would be if they added all the missing skills to their resume. This bridges the gap between "analysis" (ATS Engine) and "action" (Resume Optimizer).

### Calculation Logic

```
-- Simulate perfect skill coverage
simulated_skills    = student.skills ∪ missing_skills ∪ project_keywords

-- Recompute skill_score assuming all opportunity skills are matched
simulated_skill_score = 1.0

-- All other components remain unchanged (they don't improve by adding skills)
improvement_score = (
  1.0                * 0.55 +   -- Simulated perfect skill_score
  project_score      * 0.15 +   -- Unchanged
  experience_score   * 0.20 +   -- Unchanged
  education_score    * 0.10     -- Unchanged
) * 100
```

**Rule:** `improvement_score` is always >= `ats_score`. If the student already has a perfect skill match, both values are equal.

### Worked Example

Student: ATS Score = 55 (from Section 3 example)
- skill_score was 0.40
- project_score = 0.20
- experience_score = 1.0
- education_score = 1.0

Simulated (if student adds scikit-learn + ml):
```
improvement_score = (1.0 × 0.55) + (0.20 × 0.15) + (1.0 × 0.20) + (1.0 × 0.10)
                  = 0.55 + 0.03 + 0.20 + 0.10
                  = 0.88 × 100
                  = 88
```

> Note: Perfect improvement_score is 88 (not 95) because project_score stays at 0.20. To reach 95+ the student would also need to add project_matched_skills via project keywords. If project_score also becomes 1.0: `(0.55 + 0.15 + 0.20 + 0.10) × 100 = 100`.

---

### Integration with Recommendation Engine

The Recommendation Engine uses a simplified 6-component scoring formula for feed ranking. The ATS Engine uses a 4-component formula for detail-page analysis. They are intentionally separate:
- Rec Engine: Optimised for fast, relative ranking across thousands of rows.
- ATS Engine: Optimised for accurate, explainable single-opportunity analysis.

The `missing_skills` array output by the ATS Engine is identical to the `missing_skills` shown in the Recommendation Engine's "Improve Your Match" section on the detail page. Both features share the same data source.

### Integration with Resume Optimizer

The "Improve Your Resume →" button deep-links to the Resume Optimizer with the following query parameters:
```
/resume/optimize?opportunity_id=<uuid>&missing_skills=scikit-learn,ml
```

The Resume Optimizer reads this payload and:
1. Pre-selects the missing skills as "target keywords".
2. Highlights relevant existing bullets that could be rewritten to include these keywords.
3. Calls Gemini 1.5 Flash to suggest improved bullet rewrites incorporating the missing skills.

This is the only point at which AI enters the pipeline — **after** the deterministic ATS Engine has already identified exactly which skills need to be highlighted.

---

## SECTION 9: PERFORMANCE

### Computation Complexity

The ATS Engine performs array intersection operations on two small arrays:
- `opp.extracted_skills`: Typically 5–20 items.
- `student.skills`: Typically 5–30 items.
- `student.project_keywords`: Typically 10–50 items (flattened).

Array intersection of these sizes is O(n × m) where n, m < 50. This is sub-millisecond JavaScript. The bottleneck is **not computation** — it is the database fetch.

### Database Query Strategy

Two queries are made per request:
1. Fetch student inputs from `v_student_ats_inputs` (indexed by `user_id` via `primary_resume_id`): ~5ms.
2. Fetch opportunity data: `SELECT extracted_skills, experience_level, category FROM opportunities WHERE id = $1`: ~2ms (primary key lookup).

**Total DB time: < 10ms. Total API response: < 50ms.**

### At 50,000 Opportunities

The ATS Engine is not affected by the opportunity dataset size, because it always scores exactly ONE opportunity per request. Dataset growth does not degrade performance.

The only risk is concurrent load. At high concurrency (e.g. 1,000 students opening opportunity detail pages simultaneously), the Supabase DB connection pool may become a bottleneck. Mitigation: activate the `ats_cache` table and serve cached results for the same `(user_id, opportunity_id)` pair.

### Caching Strategy

**Client-Side (MVP):**
- SWR or React Query with `staleTime: 5 minutes`.
- Cache key: `ats-${userId}-${opportunityId}`.
- Invalidate when `resumes.resume_updated_at` changes.

**Server-Side (Future, at scale):**
- `ats_cache` table with 6-hour TTL.
- Invalidate on `resume_updated_at` change via Supabase database webhook.

### Response Time Targets

| Scenario | Target |
| :--- | :--- |
| Cold request (no cache) | < 300ms |
| Warm request (client cache) | < 10ms |
| Server cache hit (future) | < 20ms |

---

## SECTION 10: EDGE CASES

| Edge Case | Handling |
| :--- | :--- |
| **No Resume Uploaded** | API returns `{ fallback: true, ats_score: null }`. UI renders "Upload resume" CTA. No computation attempted. |
| **Resume Unverified** | Same as no resume. `v_student_ats_inputs` view filters `WHERE status = 'verified'`. Returns empty result set → fallback triggered. |
| **No Skills on Resume** | `skill_score = 0`. `project_score` still computed from projects. Score is low but honest. No crash. |
| **No Projects on Resume** | `project_score = 0.5` (neutral). No project_matched_skills returned. UI hides Section 4 entirely. |
| **Opportunity has no `extracted_skills`** | `skill_score = 0.5` (neutral), `project_score = 0.5`. Score reflects experience and education only. UI shows message: "This opportunity has no listed skill requirements." |
| **Duplicate Skills on Resume** | Normalised to lowercase and deduplicated in the Normalisation Layer before any comparison. No double-counting. |
| **Very Low ATS Score (< 20)** | Score is displayed honestly. UI shows a soft warning: "This may be a reach opportunity. Apply after improving your resume." No suppression of score. |
| **All Skills Match (100% coverage)** | `skill_score = 1.0`. Improvement score = current score (no improvement needed). "Improve" section is hidden. Trigger confetti micro-animation. |
| **Skill appears in both skills and projects** | Counted once in `matched_skills` (skill wins). Deduplicated before project matching. Never double-counted. |

---

## SECTION 11: SECURITY

### Authentication

All ATS Engine requests require a valid Supabase JWT session. The `user_id` is extracted from the server-side session using `@supabase/ssr` — it is never accepted as a client-provided parameter. This prevents score-snooping across user accounts.

```typescript
// Route Handler pattern
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = user.id  // Never from req.query
```

### Row Level Security (RLS)

```sql
-- resumes: user can only read their own rows
CREATE POLICY "resumes_select_own" ON resumes
  FOR SELECT USING (auth.uid() = user_id);

-- opportunities: all authenticated users can read
CREATE POLICY "opportunities_select_authenticated" ON opportunities
  FOR SELECT USING (auth.role() = 'authenticated');
```

### Data Access Boundaries

| Data | Access Rule |
| :--- | :--- |
| Student resume data | Only the resume owner can trigger ATS analysis |
| Opportunity data | Read-only to all authenticated users |
| ATS results | Computed server-side. Never stored in MVP. Never exposed to other users. |

### Privacy

- ATS scores are never stored in the database in MVP (computed on demand).
- Resume data never leaves the server-side computation — it is fetched and used within the Route Handler and not returned to the client beyond what the student already provided.

### Rate Limiting

```typescript
// 60 ATS requests per user per hour
// Implemented via a lightweight in-memory store or Upstash Redis
const RATE_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 }
```

Protection against:
- Automated scraping of opportunity skill lists via ATS analysis.
- Accidental infinite loops in client-side code that hammers the API.

---

## SECTION 12: IMPLEMENTATION ORDER

**Estimated Total Effort:** 1.5 Weeks (Small Team)

**Step 1: ATS Computation Library (Days 1–2)**
- Create `/lib/ats-engine.ts` — Pure TypeScript module with no database or API dependencies.
- Implement `normaliseSkills()`, `computeSkillScore()`, `computeProjectScore()`, `computeExperienceScore()`, `computeEducationScore()`, `computeGapAnalysis()`, `computeImprovementScore()`.
- Write unit tests with at least 10 test cases covering all edge cases from Section 10.

**Step 2: Database View (Day 3)**
- Create `v_student_ats_inputs` view in Supabase.
- Verify `extracted_skills` backfill is complete on `opportunities` (dependency from Rec Engine TDD).

**Step 3: API Route (Days 4–5)**
- Implement `GET /api/ats/analyze`.
- Connect view + opportunity query + ATS library.
- Add authentication guard, rate limiting middleware, and error handling.
- Test API with Postman/curl using known test data.

**Step 4: ATS Center UI (Days 6–10)**
- Build `AtsScoreCard` component (score ring, coverage bar).
- Build `SkillPillList` component (shared by matched/missing/project sections).
- Build `GapAnalysisSection` component.
- Build `ImproveYourMatch` component.
- Assemble `AtsCenterPanel` from all components.
- Integrate into Opportunity Detail page (right column, loads in parallel with job data).
- Implement loading skeleton, fallback state, and error state.

**Step 5: Testing (Days 11–12)**
- Integration test: Use 3 verified student profiles (high match, medium match, low match) against 5 known opportunities.
- Verify determinism: Run same request 5 times, confirm identical output.
- Verify "Improve" score calculation against manual computation.
- Measure API response time (target: < 300ms cold).

### Dependencies

| Dependency | Source |
| :--- | :--- |
| `resumes.parsed_data` with `skills[]`, `projects[]`, `experience[]`, `education[]` | Resume Parser TDD |
| `resumes.status = 'verified'` | Resume Review Screen |
| `profiles.primary_resume_id` | Resume Parser TDD |
| `opportunities.extracted_skills` backfilled | Recommendation Engine TDD |

---

## SECTION 13: FINAL CTO REVIEW

### Scalability

The ATS Engine is inherently scalable. Unlike the Recommendation Engine (which scores thousands of rows), the ATS Engine scores exactly one opportunity. It does not get slower as the opportunity database grows. The only scaling consideration is concurrent users, which is addressed by the `ats_cache` table design in Section 5.

**Verdict: ✅ Scalable by design.**

### Maintainability

By placing all ATS computation in a single pure TypeScript module (`/lib/ats-engine.ts`), the scoring formula is:
- Unit testable without any database or network dependency.
- Editable without touching any database migration.
- Debuggable by reading one file.

Weight adjustments (e.g., changing `skills` from 55% to 60%) require changing one constant and redeploying. No database migration required.

**Verdict: ✅ Highly maintainable.**

### Accuracy

The ATS Engine mirrors the behaviour of real keyword-matching ATS systems (Taleo, Workday, Greenhouse) which perform exact or near-exact keyword intersection. By using normalised lowercase arrays and explicit deduplication, the engine avoids false positives (counting "Python" and "python" as two different skills).

**Known limitation:** The engine does not handle skill synonyms (e.g., "ML" vs "Machine Learning"). This is intentional — adding synonym mapping in MVP adds complexity with minimal verified benefit. Synonym normalisation is documented as a future enhancement.

**Verdict: ✅ Accurate for MVP. One known, accepted limitation.**

### Future Compatibility

| Future Feature | Compatibility |
| :--- | :--- |
| Resume Optimizer | ✅ `missing_skills[]` is already the exact input the Optimizer needs |
| Placement Dashboard | ✅ `ats_score` can be aggregated across the student cohort |
| Skill Gap Courses | ✅ `missing_skills[]` maps directly to learning resource recommendations |
| Synonym Normalisation | ✅ Add a `skill_synonyms` lookup table; update normalisation layer only |
| Cached Scoring | ✅ `ats_cache` table is pre-designed and ready to activate |

### Approved Decisions

| Decision | Rationale |
| :--- | :--- |
| ATS computation in TypeScript, not PostgreSQL RPC | Single-opportunity scoring is trivial compute; application-layer code is easier to test and maintain than PL/pgSQL. |
| No AI in ATS scoring pipeline | Determinism and explainability are non-negotiable. AI adds latency, cost, and unpredictability to what is a solved mathematics problem. |
| No synonym mapping in MVP | Engineering cost is high, user benefit is unproven. Defer and measure. |
| `ats_cache` table not activated in MVP | Current dataset and user base do not require it. The design is pre-documented for future activation. |
| Separate ATS formula from Recommendation Engine formula | Different purposes, different weights. The Rec Engine trades accuracy for speed across thousands of rows. The ATS Engine trades speed for accuracy on one row. |

### Rejected Decisions

| Decision | Reason Rejected |
| :--- | :--- |
| Use Gemini to compute ATS scores | Non-deterministic. Different results each call. Expensive at scale. Adds 2–5 second latency per page view. |
| Store ATS results in `resumes` table | Violates single-responsibility. Resume table stores resume data, not derived analytics. |
| Run ATS computation client-side in the browser | Requires sending the student's full resume JSON to the client on every page load. Privacy and performance concern. |
| Merge ATS Engine with Recommendation Engine | They serve different purposes. Coupling them creates a maintenance nightmare and prevents independent scaling. |

### Risks

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| `extracted_skills` backfill incomplete on opportunities | High | Block ATS feature launch on completion of backfill migration. |
| Students game the score by adding every keyword | Low | This is acceptable behaviour — they're improving their resumes. |
| Resume Parser produces inconsistent `skills[]` arrays | Medium | Zod schema validation at save time guarantees `skills` is always `string[]`. |
| ATS score differs from real employer ATS systems | Low | We are transparent that this is an approximation. Exact ATS parity is impossible without vendor access. |

### Final Recommendation

The ATS Engine design is production-ready. It is the correct architecture for this use case:
- Simple enough to build in 1.5 weeks.
- Accurate enough to be genuinely useful to students.
- Fast enough to load in parallel with the job description.
- Maintainable enough to be modified by a single engineer without risk.
- Extensible enough to power every downstream feature on the V2 roadmap.

**Cleared for implementation. Begin with Step 1: `/lib/ats-engine.ts`.**
