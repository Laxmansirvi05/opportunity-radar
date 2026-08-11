# Technical Design Document (TDD) — v2
**Feature:** Opportunity Recommendation Engine + Match Score
**Stack:** Next.js 16, TypeScript, Tailwind, Supabase PostgreSQL
**Constraint:** No vector database. No embeddings. No AI scoring. Deterministic only.
**Last Updated:** 2026-06-19 (7 architecture changes applied)

---

## SECTION 1: FEATURE OVERVIEW

**Purpose:**
Replace the generic chronological opportunity feed with a personalised, ranked feed where every opportunity is scored against the student's verified resume. Every student should see a different, relevant ranking — not a one-size-fits-all list.

**User Flow:**
1. Student has a verified resume in the database (`resumes.status = 'verified'`).
2. Student opens the Opportunity Feed.
3. System fetches the student's skills, projects, education, and experience level.
4. System scores every active opportunity against these inputs using the Match Score Engine.
5. Feed is sorted by Match Score (highest first) with a visible score badge on each card.
6. Student sees their most relevant opportunities at the top.
7. On the Opportunity Detail page, the student sees a full score breakdown and an "Improve Your Match" section.

**Success Criteria:**
* Ranked feed loads in under 2 seconds for 5,000 opportunities.
* A student with `skills: ['React', 'Node.js']` consistently sees React/Node jobs above unrelated roles.
* Match Score is visible on every card and is a value between 0–100.
* Students with no resume see a fallback "Explore All" feed.
* Project keywords from the resume contribute meaningfully to ranking for students with no work experience.

**Failure Criteria:**
* All students see the same feed regardless of skills.
* Projects are ignored, disadvantaging students with no work experience.
* Feed takes over 5 seconds to load.
* High-relevance opportunities are excluded because of a premature LIMIT.

---

## SECTION 2: RECOMMENDATION ENGINE

**Architecture Decision: Server-Side Scoring via PostgreSQL RPC**

The scoring computation happens inside a PostgreSQL stored procedure (RPC). Fetching 5,000 rows to the application server and scoring in JavaScript is not scalable. All scoring logic runs at the database layer.

**Inputs to the Engine:**
* `student_skills: text[]` — From `resumes.parsed_data -> skills`
* `student_project_keywords: text[]` — Extracted from `resumes.parsed_data -> projects[].technologies` (flattened and deduplicated)
* `student_experience_level: text` — Derived from years of experience in `resumes.parsed_data -> experience`
* `student_education_level: text` — Derived from `resumes.parsed_data -> education`
* `student_interests: text[]` — From `profiles.interests`
* Opportunity fields: `extracted_skills text[]`, `category`, `experience_level`, `deadline`, `posted_at`

**Output:**
* Array of `{ opportunity_id, match_score, matched_skills, missing_skills, project_matched_skills }` tuples, sorted descending.

---

## SECTION 3: MATCH SCORE ENGINE

### CHANGE 1 APPLIED — Updated Weighted Formula

**Previous formula (deprecated):**
```
skill_score * 0.55 + experience_score * 0.20 + category_score * 0.10 + recency_score * 0.10 + deadline_score * 0.05
```

**New formula (approved):**
```
MATCH_SCORE = (
  skill_score       * 0.50 +   -- Skills remain the primary signal
  experience_score  * 0.15 +   -- Reduced; students have thin experience
  project_score     * 0.10 +   -- NEW: Project keyword overlap
  category_score    * 0.10 +   -- Category/interest alignment
  recency_score     * 0.10 +   -- Prefer newly posted
  deadline_score    * 0.05     -- Penalise near-expiry
) * 100
```

**Rationale for Project Match Addition:**
Students applying for internships and junior roles often have zero professional experience. Their projects demonstrate applied skill, and ignoring project keywords systematically underranks the most relevant opportunities for this user group. At 10% weight, projects meaningfully differentiate candidates without overriding verified skill matches.

---

**Component Calculations:**

**1. `skill_score` (0.0 to 1.0)**
```
matched_skills    = COUNT(opp.extracted_skills ∩ student.skills)
total_opp_skills  = ARRAY_LENGTH(opp.extracted_skills)

IF total_opp_skills = 0 THEN skill_score = 0.3   -- Neutral for undocumented jobs
ELSE skill_score = LEAST(matched_skills::float / total_opp_skills, 1.0)
```
*Example: Job needs [Python, SQL, ML]. Student has [Python, SQL]. skill_score = 2/3 = 0.67.*

**2. `experience_score` (0.0 to 1.0)**
```
IF opp.experience_level = 'Any'         THEN 1.0
IF opp.experience_level = 'Fresher'     AND student_years_exp = 0  THEN 1.0
IF opp.experience_level = 'Undergrad'   AND student_years_exp <= 2 THEN 1.0
IF opp.experience_level = 'Masters'     AND student_edu = 'Masters' THEN 1.0
ELSE 0.3
```

**3. `project_score` (0.0 to 1.0) — NEW**

Project keywords are extracted from the student's `projects[].technologies` arrays in the parsed resume JSON. They are deduplicated and lowercased before comparison.

```
student_project_keywords = DISTINCT LOWER(UNNEST(project.technologies)) for each project

project_matched = COUNT(opp.extracted_skills ∩ student_project_keywords)
total_opp_skills = ARRAY_LENGTH(opp.extracted_skills)

IF total_opp_skills = 0 THEN project_score = 0.2   -- Neutral
ELSE project_score = LEAST(project_matched::float / total_opp_skills, 1.0)
```

*Example: Job needs [React, TypeScript, Node.js]. Student's project used [React, TypeScript, MongoDB]. project_matched = 2, project_score = 2/3 = 0.67.*

**Key Rule:** Project keywords and skill keywords are separate inputs. They are NOT merged before comparison. This allows the breakdown to show:
* ✅ Matched from Skills: React
* ✅ Matched from Projects: TypeScript
* ❌ Missing: Docker

**4. `category_score` (0.0 to 1.0)**
```
IF opp.category IN (student.interests) THEN 1.0
ELSE 0.5   -- Neutral, not penalised
```

**5. `recency_score` (0.0 to 1.0)**
```
days_since_posted <= 1   → 1.0
days_since_posted <= 3   → 0.9
days_since_posted <= 7   → 0.7
days_since_posted <= 14  → 0.5
else                     → 0.3
```

**6. `deadline_score` (0.0 to 1.0)**
```
deadline IS NULL            → 0.8
hours_to_deadline > 72      → 1.0
hours_to_deadline 24–72     → 0.5
hours_to_deadline < 24      → 0.1
```

Minimum displayable score: Any opportunity scoring below 10 is still shown, ranked last. Nothing is hidden.

---

## SECTION 4: DATABASE DESIGN

### CHANGE 2 APPLIED — Corrected Query Strategy: Filter → Score → Sort → Limit

**Previous (incorrect) approach:** Apply `LIMIT 200` BEFORE scoring. This could exclude highly relevant opportunities that happened to be older.

**Correct approach:**
```
Step 1: FILTER  — Reduce working set to only active, valid opportunities.
Step 2: SCORE   — Compute match_score for every row in the filtered set.
Step 3: SORT    — ORDER BY match_score DESC, posted_at DESC.
Step 4: LIMIT   — Apply LIMIT only after the full ranked set is produced.
```

**Performance rationale:**
At 5,000 opportunities, after filtering to `status = 'Published'` and non-expired deadlines, the working set is typically 2,000–3,000 rows. Scoring all 3,000 rows inside PostgreSQL using integer arithmetic on a GIN-indexed array column takes < 50ms. This is fast enough that a premature LIMIT buys no meaningful performance gain and actively harms ranking quality. The LIMIT is only applied after the full ranked list is produced, returning the top N for the current page.

At 50,000+ opportunities, this approach is re-evaluated (see Section 8).

**`opportunities` table — Required Changes:**
```sql
-- New column
ALTER TABLE opportunities ADD COLUMN extracted_skills TEXT[] DEFAULT '{}';

-- Indexes
CREATE INDEX idx_opp_extracted_skills ON opportunities USING gin(extracted_skills);
CREATE INDEX idx_opp_status_posted ON opportunities(status, posted_at DESC);
CREATE INDEX idx_opp_experience_level ON opportunities(experience_level);
```

**`resumes` table — Changes (CHANGE 3 & CHANGE 6 Applied):**
```sql
-- Resume freshness tracking (store only, NOT used in MVP scoring)
ALTER TABLE resumes ADD COLUMN resume_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE resumes ADD COLUMN resume_last_reviewed_at TIMESTAMPTZ;
```

### CHANGE 3 APPLIED — Resume Freshness Tracking

**Freshness Tiers (for future use):**
| Tier | Condition | Meaning |
| :--- | :--- | :--- |
| Fresh | `resume_updated_at < 30 days ago` | Recently updated. High confidence. |
| Stale | `resume_updated_at 30–90 days ago` | Possibly outdated. Consider prompting a review. |
| Expired | `resume_updated_at > 90 days ago` | Almost certainly outdated. Show review banner. |

**How Freshness is Tracked:**
* `resume_updated_at` is automatically set via a database trigger whenever `parsed_data` is updated in the `resumes` table.
* `resume_last_reviewed_at` is set by the application layer each time the student opens the Resume Review Screen and clicks "Confirm".

**MVP Scope:** These columns are stored but NOT included in the match score formula for MVP. In a future iteration, a `freshness_penalty` signal could reduce the confidence display of scores computed against stale resumes (e.g. display "Score may be outdated — update your resume").

**`profiles` table — No New Columns Required:**
* `interests TEXT[]` — Already exists. Used for category_score.
* `primary_resume_id UUID` — Already planned. Must be set to the verified resume id.

**Updated View: `v_student_resume_data`**
```sql
CREATE OR REPLACE VIEW v_student_resume_data AS
SELECT
  p.id AS user_id,
  p.interests,
  r.parsed_data AS full_parsed_data,
  r.resume_updated_at,
  r.resume_last_reviewed_at
FROM profiles p
JOIN resumes r ON r.id = p.primary_resume_id
WHERE r.status = 'verified';
```

**Stored Procedure: `get_ranked_opportunities(user_id UUID)`**

```sql
-- Pseudocode representation of the corrected RPC
CREATE OR REPLACE FUNCTION get_ranked_opportunities(p_user_id UUID)
RETURNS TABLE (
  id UUID, title TEXT, match_score INT,
  matched_skills TEXT[], missing_skills TEXT[],
  project_matched_skills TEXT[]
) AS $$
DECLARE
  v_skills TEXT[];
  v_project_keywords TEXT[];
  v_interests TEXT[];
BEGIN
  -- 1. Fetch student inputs
  SELECT
    ARRAY(SELECT DISTINCT lower(s) FROM jsonb_array_elements_text(r.parsed_data->'skills') AS s),
    ARRAY(SELECT DISTINCT lower(t) FROM jsonb_array_elements(r.parsed_data->'projects') AS proj,
          jsonb_array_elements_text(proj->'technologies') AS t),
    p.interests
  INTO v_skills, v_project_keywords, v_interests
  FROM profiles p
  JOIN resumes r ON r.id = p.primary_resume_id
  WHERE p.id = p_user_id AND r.status = 'verified';

  -- 2. FILTER → SCORE → SORT → LIMIT (in that order)
  RETURN QUERY
  SELECT
    o.id,
    o.title,
    -- score formula applied here (integer arithmetic)
    ROUND((
      compute_skill_score(o.extracted_skills, v_skills) * 0.50 +
      compute_experience_score(o.experience_level, v_skills) * 0.15 +
      compute_project_score(o.extracted_skills, v_project_keywords) * 0.10 +
      compute_category_score(o.category, v_interests) * 0.10 +
      compute_recency_score(o.posted_at) * 0.10 +
      compute_deadline_score(o.deadline) * 0.05
    ) * 100)::INT AS match_score,
    -- explanation arrays
    ARRAY(SELECT s FROM unnest(o.extracted_skills) AS s WHERE s = ANY(v_skills)),
    ARRAY(SELECT s FROM unnest(o.extracted_skills) AS s WHERE s != ALL(v_skills) AND s != ALL(v_project_keywords)),
    ARRAY(SELECT s FROM unnest(o.extracted_skills) AS s WHERE s = ANY(v_project_keywords) AND s != ALL(v_skills))
  FROM opportunities o
  WHERE
    o.status IN ('Published', 'Closing Soon')                          -- FILTER step 1
    AND (o.deadline IS NULL OR o.deadline > NOW())                     -- FILTER step 2
  ORDER BY match_score DESC, o.posted_at DESC                          -- SORT step
  -- NO LIMIT here in the RPC; LIMIT applied at the API/pagination layer
  ;
END;
$$ LANGUAGE plpgsql;
```

### CHANGE 4 APPLIED — Future Match Cache Table

> **NOT REQUIRED FOR MVP. Documented for future scaling.**

```sql
-- Future table: pre-computed match scores for all user-opportunity pairs
CREATE TABLE user_opportunity_matches (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  match_score     INT NOT NULL,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX idx_matches_user_score ON user_opportunity_matches(user_id, match_score DESC);
```

**Purpose:**
At 50,000+ opportunities and 10,000+ users, running the scoring RPC on every page load becomes expensive. The cache table stores pre-computed scores, calculated by a background worker (Inngest/pg_cron) that runs nightly or whenever a user updates their resume.

**Future Scaling Benefit:**
* The `/api/opportunities/recommended` endpoint reads directly from `user_opportunity_matches` (< 5ms).
* The RPC is only invoked to regenerate scores when `resumes.resume_updated_at` changes.
* This reduces database load from O(users × opportunities) per request to O(1) per request.

---

## SECTION 5: API DESIGN

**1. `GET /api/opportunities/recommended`**
* **Auth:** Required (valid Supabase session).
* **Request Params:** `page=0`, `limit=20`
* **Processing:** Calls `get_ranked_opportunities(user_id)` RPC. Applies pagination offset at the API layer after the full ranked list is produced.
* **Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Frontend Engineer Intern",
      "company": { "name": "Acme Corp", "logo_url": "..." },
      "match_score": 87,
      "matched_skills": ["React", "TypeScript"],
      "project_matched_skills": ["Node.js"],
      "missing_skills": ["Docker"],
      "category": "Internship",
      "mode": "Remote",
      "deadline": "2026-07-15T00:00:00Z"
    }
  ],
  "count": 320,
  "fallback": false
}
```
* **Fallback:** If no verified resume, `fallback: true` returns generic recency-sorted feed.
* **Errors:** `401 Unauthorized`.

**2. `GET /api/opportunities/match-score`**
* **Auth:** Required.
* **Request Params:** `opportunity_id=uuid`
* **Processing:** Fetch student inputs, compute match score for the single opportunity, return full breakdown including project signal.
* **Response:**
```json
{
  "match_score": 73,
  "breakdown": {
    "skill_score": 0.80,
    "experience_score": 1.0,
    "project_score": 0.67,
    "category_score": 0.5,
    "recency_score": 0.9,
    "deadline_score": 1.0
  },
  "matched_skills": ["React", "TypeScript"],
  "project_matched_skills": ["Node.js"],
  "missing_skills": ["GraphQL", "Docker"],
  "potential_score_after_improvement": 95
}
```
* **Errors:** `401 Unauthorized`, `404 Not Found`.

---

## SECTION 6: FEED DESIGN

**1. "Top Matches For You" (Primary Section)**
* Source: `get_ranked_opportunities` sorted by `match_score DESC`.
* Criteria: `match_score >= 70`.
* Limit: Top 10 on homepage, full paginated list on /opportunities.

**2. "New This Week" (Secondary Section)**
* Source: Same RPC filtered by `posted_at >= NOW() - INTERVAL '7 days'`, sorted by `posted_at DESC`.
* Not personalised — purely recency-based.

**3. "Explore All" (Fallback for No Resume)**
* Source: `status = 'Published'` sorted by `posted_at DESC`.
* Displayed with a banner: "Upload your resume to see personalised matches."

---

## SECTION 7: UI DESIGN

**Opportunity Feed Page (`/opportunities`)**
* Callout banner if no resume: "Personalise your feed → Upload Resume"
* Tab row: "Top Matches" | "New This Week" | "All Opportunities"

**Opportunity Card Layout:**
```
┌────────────────────────────────────────┐
│  [Logo]  Company Name           [87%]  │  ← Match Score Badge
│          Role Title                    │
│          📍 Remote  •  💰 Paid         │
│          ⏰ Closes in 3 days           │
│                              [Save]    │
└────────────────────────────────────────┘
```

**Match Score Badge Variants:**
* `variant="high"` (>= 80): Green pill — "87% Match"
* `variant="medium"` (50–79): Amber pill — "65% Match"
* `variant="low"` (< 50): Grey pill — "32% Match"
* `variant="fallback"` (no resume): No badge shown

---

### CHANGE 5 APPLIED — "Improve Your Match" Section (Opportunity Detail Page)

This section appears on the Opportunity Detail page below the main job description. It shows the student their current score, what is missing, and what their score would be if they added the missing skills to their resume.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  📊 Your Match Score                        │
│                                             │
│  Current Match:     87%                     │
│                                             │
│  ✅ Matched from Skills:  React, TypeScript  │
│  🔵 Matched from Projects: Node.js          │
│  ❌ Missing Skills:       Docker, GraphQL   │
│                                             │
│  Potential Match After Improvement: 95%     │
│                                             │
│  [Improve Your Resume →]                    │
└─────────────────────────────────────────────┘
```

**Calculation Logic for "Potential Match After Improvement":**

The potential score is computed by simulating a new `skill_score` where ALL missing opportunity skills are assumed to be present on the student's resume.

```
missing_skills        = opp.extracted_skills - (student.skills ∪ student.project_keywords)
simulated_skills      = student.skills ∪ missing_skills
simulated_skill_score = 1.0  -- All required skills are now matched

potential_score = (
  1.0                  * 0.50 +    -- Simulated perfect skill score
  experience_score     * 0.15 +    -- Unchanged
  project_score        * 0.10 +    -- Unchanged
  category_score       * 0.10 +    -- Unchanged
  recency_score        * 0.10 +    -- Unchanged
  deadline_score       * 0.05      -- Unchanged
) * 100
```

*Example: Current match_score = 87. skill_score was 0.80 (missing Docker, GraphQL). With perfect skill match, score becomes (1.0 × 0.50) + (remaining scores sum to 0.45) = 0.95 × 100 = 95.*

**Integration with ATS Engine:**
The missing skills list (`missing_skills[]`) is the same array used by the ATS Engine's "Keyword Gap" analysis. Both features share the same data source — there is no separate computation. A student viewing this section sees the exact same missing keywords that the ATS Engine would highlight.

**Integration with Resume Optimizer:**
The "Improve Your Resume →" button deep-links to the Resume Optimizer with the `missing_skills` array pre-loaded as suggested addition targets. The Optimizer can pre-populate its rewrite suggestions using these missing keywords.

---

## SECTION 8: PERFORMANCE

**At 5,000 Opportunities (Current Scale):**
* Pre-filter to `Published` status reduces working set to ~2,000–3,000 rows.
* GIN-indexed `extracted_skills` array overlap is O(log n) per row.
* Full scoring + sort of 3,000 rows inside PostgreSQL: < 50ms.
* API response target: < 500ms including network overhead.
* No premature LIMIT — all qualifying rows are scored before truncation.

**At 50,000 Opportunities (Future Scale):**
* Activate the `user_opportunity_matches` cache table (see Section 4, Change 4).
* A background job (Inngest or pg_cron) pre-computes scores nightly.
* The API reads from the cache table in O(1) instead of running the RPC.
* The partial index on `status = 'Published'` becomes mandatory to keep filter step fast.

**Prohibited Patterns:**
* Never fetch all 5,000+ rows to the JavaScript application layer for scoring.
* Never apply LIMIT before scoring — this breaks ranking quality.
* Never call an AI model to compute the score on demand.
* Never score without the GIN index on `extracted_skills`.

---

## SECTION 9: EDGE CASES

| Edge Case | Handling |
| :--- | :--- |
| No Resume Uploaded | Return generic recency feed. Show "Upload Resume" CTA banner. |
| Resume Unverified | Same as no resume. Only `status = 'verified'` resumes trigger personalisation. |
| Incomplete Resume (No Skills, No Projects) | `skill_score = 0`, `project_score = 0`. Feed ranks purely on recency and category. |
| No Project Technologies Extracted | `project_score = 0.2` (neutral, not penalised). Skill signals dominate. |
| All Match Scores Low (< 30%) | Show feed sorted by score. Display: "Your skills are rare — expand your interests in settings." |
| Large Dataset (50,000+) | Activate cache table. Pre-compute scores in background. |
| Duplicate Skills in Resume | Normalise to lowercase and deduplicate: `ARRAY(SELECT DISTINCT lower(unnest(skills)))`. |
| Opportunity Has No `extracted_skills` | `skill_score = 0.3`, `project_score = 0.2` (both neutral). Ranks on other signals. |
| Skills Appear in Both Skills and Projects | Deduplicated before comparison. A skill is not double-counted. |

---

## SECTION 10: FINAL ARCHITECTURE REVIEW (CHANGE 7)

### Approved Changes

| Change | Decision | Reason |
| :--- | :--- | :--- |
| Project Match Signal (10%) | **Approved** | Critical for student users with no professional experience. Low complexity, high ROI. |
| Filter → Score → Sort → Limit order | **Approved** | Eliminates the ranking defect where relevant older opportunities were excluded. No performance regression at current scale. |
| Resume freshness columns (store only) | **Approved** | Zero-cost to add. High future value. Does not affect MVP scoring. |
| Future `user_opportunity_matches` cache | **Approved (Future)** | Correct scaling path. Not needed for MVP. |
| "Improve Your Match" UI section | **Approved** | High visible user value. Reuses existing data — no extra API calls or new computation. |
| Project keywords in score breakdown | **Approved** | Differentiates project matches from skill matches in the explanation UI. |

### Rejected Changes

| Change | Decision | Reason |
| :--- | :--- | :--- |
| Include freshness in MVP scoring | **Rejected** | Adds complexity. The student population is small; stale resumes are not yet a meaningful signal. Track first, score later. |
| Merge project keywords with skill keywords before scoring | **Rejected** | Merging eliminates the ability to show which matches came from skills vs. projects in the explanation UI. |
| Apply LIMIT before scoring | **Rejected** | Degrades ranking quality. The performance trade-off is not justified at current scale. |

### Risks

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Project keyword extraction quality depends on parsed JSON | Medium | Same Zod schema validation applied at resume save time ensures `projects[].technologies` is always a `string[]`. |
| Scoring RPC becomes slow at 20,000+ opportunities | Medium | Monitor query time. Activate cache table if p95 latency > 1s. |
| Students add random project technologies to game scores | Low | This is a feature, not a bug — students are improving their profiles. |

### Final Recommendation

The updated TDD is production-ready for MVP execution. The scoring formula is deterministic, explainable, performant, and correct for the target user (students with thin professional experience but substantive project work). No further changes to the core architecture are required before implementation begins.

---

## SECTION 11: IMPLEMENTATION ORDER

**Estimated Total Effort:** 2 Weeks (Small Team, including new changes)

**Step 1: Database Migration (Days 1–2)**
* Add `extracted_skills` column to `opportunities` with GIN index.
* Add `resume_updated_at` and `resume_last_reviewed_at` to `resumes`.
* Create `v_student_resume_data` view (updated with freshness columns).
* Write and test `get_ranked_opportunities(user_id)` PostgreSQL RPC with new formula.

**Step 2: Skills Backfill (Days 3–4)**
* One-time migration script: extract and normalise keywords from existing 4,700 opportunity records into `extracted_skills`.

**Step 3: API Layer (Days 5–6)**
* Implement `GET /api/opportunities/recommended` with correct Filter→Score→Sort→Limit order.
* Implement `GET /api/opportunities/match-score` returning full breakdown + `potential_score_after_improvement`.
* Write fallback logic for users with no verified resume.

**Step 4: UI Integration (Days 7–10)**
* Build `MatchScoreBadge` component (`high/medium/low/fallback` variants).
* Update `OpportunityCard` to display badge and `project_matched_skills`.
* Add "Top Matches" tab to the feed page.
* Build "Improve Your Match" section on the Opportunity Detail page.
* Wire "Improve Your Resume →" deep-link to the Resume Optimizer.

**Step 5: Testing & Validation (Days 11–14)**
* Test with a verified resume containing known skills AND projects.
* Verify project-matched skills appear separately from skill-matched skills in the UI.
* Confirm "Potential Match" calculation is correct on at least 5 test opportunities.
* Measure RPC query time at 5,000 rows; validate < 500ms target.

**Key Dependencies:**
* `resumes` table with `status = 'verified'` record (from Resume Parser TDD).
* `opportunities.extracted_skills` backfilled before the feed is meaningful.
* `profiles.primary_resume_id` linked by the Resume Parser pipeline.
* ATS Engine `missing_skills` array must be the same data source as the Improve Your Match section.
