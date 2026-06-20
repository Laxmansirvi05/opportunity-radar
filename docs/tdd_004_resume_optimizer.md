# TDD-004: Resume Optimizer
**Project:** Opportunity Radar V2
**Stack:** Next.js 16, TypeScript, Tailwind, Supabase PostgreSQL
**AI Providers:** Gemini 1.5 Flash (primary), Groq / Llama-3 (fallback)
**Constraint:** Never fabricate experience, metrics, or achievements. Preserve factual accuracy.
**Version:** 1.0

---

## SECTION 1: FEATURE OVERVIEW

### Purpose

Transform weak, vague, or generic resume bullet points into ATS-friendly, professionally worded bullets using the STAR (Situation, Task, Action, Result) methodology. The optimizer is triggered after the ATS Engine identifies skill gaps, and it helps the student rewrite existing bullets to better surface the skills required by a specific opportunity.

**Critical Rule:** The AI may only rephrase what the student has already written. It may NOT invent job titles, companies, metrics, or achievements that do not exist in the original text.

### User Flow

1. Student views an opportunity and sees ATS Score = 62, Missing Skills = `[Docker, CI/CD]`.
2. Student clicks "Improve Your Resume →".
3. Resume Optimizer page loads, pre-loaded with:
   - The student's verified resume bullets (from `resumes.parsed_data`)
   - The missing skills list (from ATS Engine output)
   - The target opportunity title and company
4. Student selects a specific bullet point to improve.
5. System sends the bullet + context to Gemini Flash.
6. Three alternative rewrites are returned, each emphasising different aspects.
7. Student picks one, edits if needed, and saves.
8. A new resume version is created. The original is preserved.

### Success Criteria

* 3 alternatives generated in < 5 seconds (Gemini Flash target).
* All alternatives use STAR format and naturally incorporate the target skill keyword.
* Original bullet is always preserved and visible for comparison.
* Zero fabricated metrics or invented achievements in output.

### Failure Criteria

* AI invents job titles, companies, numbers, or technologies not present in the original.
* Generation takes > 15 seconds (Gemini timeout; triggers Groq fallback).
* Student loses their original bullet during optimization.

---

## SECTION 2: AI ARCHITECTURE

```
Student Selects Bullet
        ↓
┌──────────────────────────────┐
│  Context Assembler           │
│  - Original bullet text      │
│  - Target opportunity title  │
│  - Missing skills list       │
│  - STAR prompt template      │
└──────────────────────────────┘
        ↓
┌──────────────────────────────┐
│  AI Gateway Layer (TDD-007)  │
│  - Primary: Gemini Flash     │
│  - Fallback: Groq/Llama-3    │
│  - Timeout: 10s              │
│  - Retry: 1 automatic        │
└──────────────────────────────┘
        ↓
┌──────────────────────────────┐
│  Response Validator          │
│  - Length check (> 15 words) │
│  - Fabrication guard         │
│  - STAR format check         │
└──────────────────────────────┘
        ↓
  3 Alternative Bullets
```

**Why Gemini 1.5 Flash?**
- Fast (< 3s P50 latency for short prompts)
- Cheap ($0.075 / 1M input tokens)
- Strong instruction-following for structured output

**Why Groq/Llama-3 as fallback?**
- Extremely fast inference (200+ tokens/sec)
- Free tier available during early MVP
- Different provider = different failure modes = true redundancy

---

## SECTION 3: PROVIDER STRATEGY

### Primary: Gemini 1.5 Flash

```
Timeout: 10 seconds
Retry:   1 automatic on timeout or 5xx
Budget:  $20/month hard cap (see Section 10)
```

### Fallback: Groq (Llama-3-8b-8192)

```
Trigger:  Gemini timeout > 10s OR 5xx error after 1 retry
Timeout:  8 seconds
Retry:    0 (fail fast, show error)
Budget:   Free tier for MVP
```

### Fallback Decision Tree

```
Request arrives
  → Try Gemini Flash (timeout: 10s)
      SUCCESS → return result
      FAIL (timeout/5xx)
        → Retry Gemini once (timeout: 10s)
            SUCCESS → return result
            FAIL
              → Try Groq Llama-3 (timeout: 8s)
                  SUCCESS → return result, log provider=groq
                  FAIL → return 503 error, show user-friendly message
```

---

## SECTION 4: PROMPT ENGINEERING STRATEGY

### Prompt Template (System Prompt)

```
You are an expert resume writer helping a student improve their resume bullet points.

RULES (STRICT - DO NOT VIOLATE):
1. You MUST only use information present in the ORIGINAL BULLET.
2. You MUST NOT invent numbers, percentages, company names, or achievements.
3. You MUST NOT add technologies or tools not mentioned in the original.
4. If a TARGET SKILL can be naturally incorporated based on the original context, do so.
5. Each rewrite must follow STAR format: describe the Action taken and the Result achieved.
6. Each rewrite must be 1-2 sentences maximum.
7. Output exactly 3 alternatives, numbered 1, 2, 3.
8. Do not add explanations or preambles. Output only the 3 bullet alternatives.

FORMAT:
1. [Rewrite 1]
2. [Rewrite 2]
3. [Rewrite 3]
```

### User Prompt Template

```
ORIGINAL BULLET:
"{original_bullet}"

TARGET OPPORTUNITY: {opportunity_title} at {company_name}
TARGET SKILL TO EMPHASISE: {primary_missing_skill}

Generate 3 improved versions of this bullet point.
```

### Fabrication Guard (Post-Processing)

After receiving AI output, run a validation check:

```typescript
function validateBullet(original: string, generated: string): boolean {
  // Extract all numbers from the generated output
  const generatedNumbers = generated.match(/\d+%?x?/g) || []
  const originalNumbers = original.match(/\d+%?x?/g) || []

  // If generated contains numbers not in original, REJECT
  for (const num of generatedNumbers) {
    if (!originalNumbers.includes(num)) return false
  }

  // Minimum length check
  if (generated.split(' ').length < 8) return false

  return true
}
```

If validation fails → retry once with same prompt → if second failure, return the original bullet unchanged with error message.

---

## SECTION 5: RESUME VERSIONING STRATEGY

### Core Principle: Non-Destructive Editing

Every resume optimization creates a new version. The original verified resume is never overwritten. The student can always revert.

### Version Model

```
resumes (original verified resume)
  └── resume_versions
       ├── version 1 (optimized for "Data Science Intern @ Acme")
       ├── version 2 (optimized for "ML Engineer @ Startup")
       └── version 3 (manual edits)
```

### Version Lifecycle

1. Student selects a bullet and chooses an alternative.
2. System creates a new `resume_versions` row with the updated `parsed_data` JSONB.
3. The original `resumes` row is untouched.
4. The student can name their version ("Tailored for Google") or leave it as a timestamp.
5. Max versions per user: 10 (soft limit, configurable). Oldest deleted automatically beyond limit.

---

## SECTION 6: DATABASE DESIGN

### New Table: `resume_versions`

```sql
CREATE TABLE resume_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_resume_id  UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  label           TEXT,
  parsed_data     JSONB NOT NULL,
  changes         JSONB NOT NULL DEFAULT '[]',
  -- changes: [{ "section": "experience", "index": 0, "bullet_index": 1, "original": "...", "optimized": "..." }]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_versions_user ON resume_versions(user_id, created_at DESC);
CREATE INDEX idx_resume_versions_base ON resume_versions(base_resume_id);
```

### New Table: `optimizer_requests` (Audit + Cost Tracking)

```sql
CREATE TABLE optimizer_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id),
  original_bullet TEXT NOT NULL,
  target_skill    TEXT,
  provider        TEXT NOT NULL,         -- 'gemini' | 'groq'
  tokens_used     INT,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimizer_requests_user ON optimizer_requests(user_id, created_at DESC);
```

**Why `optimizer_requests`?**
- Tracks per-user AI usage for rate limiting.
- Tracks provider costs (tokens × price/token = cost per request).
- Provides data for monitoring and billing alerts.

### RLS Policies

```sql
-- resume_versions: user sees only their own
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_own" ON resume_versions
  FOR ALL USING (auth.uid() = user_id);

-- optimizer_requests: user sees only their own
ALTER TABLE optimizer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "optimizer_own" ON optimizer_requests
  FOR ALL USING (auth.uid() = user_id);
```

---

## SECTION 7: API DESIGN

### `POST /api/resume/optimize`

**Purpose:** Generate 3 optimized bullet alternatives.

**Auth:** Required.

**Request:**
```json
{
  "resume_id": "uuid",
  "opportunity_id": "uuid",
  "bullet_text": "Developed a web application for inventory management",
  "bullet_location": {
    "section": "experience",
    "experience_index": 0,
    "bullet_index": 1
  },
  "target_skill": "Docker"
}
```

**Processing:**
1. Verify `resume_id` belongs to `auth.uid()`.
2. Check rate limit (max 20 requests/user/day).
3. Assemble prompt from template.
4. Call AI Gateway (Gemini → Groq fallback).
5. Validate output via fabrication guard.
6. Log to `optimizer_requests`.
7. Return alternatives.

**Response (200 OK):**
```json
{
  "alternatives": [
    "Engineered an inventory management web application using containerized deployment, enabling consistent production environments across teams.",
    "Built and deployed a web-based inventory system, applying containerization principles to streamline the release process.",
    "Developed a full-stack inventory management application with environment consistency as a core design constraint."
  ],
  "provider": "gemini",
  "latency_ms": 1840
}
```

**Errors:**
- `401 Unauthorized`
- `429 Too Many Requests` (rate limit exceeded)
- `503 Service Unavailable` (both providers failed)

---

### `POST /api/resume/save-version`

**Purpose:** Save the student's chosen bullet as a new resume version.

**Request:**
```json
{
  "base_resume_id": "uuid",
  "opportunity_id": "uuid",
  "label": "Tailored for Google SWE",
  "changes": [
    {
      "section": "experience",
      "experience_index": 0,
      "bullet_index": 1,
      "original": "Developed a web application...",
      "optimized": "Engineered an inventory management..."
    }
  ]
}
```

**Processing:**
1. Load `base_resume_id.parsed_data`.
2. Apply changes array to produce `new_parsed_data`.
3. Insert into `resume_versions`.
4. Return new version id.

**Response (201 Created):**
```json
{ "version_id": "uuid", "label": "Tailored for Google SWE" }
```

---

### `GET /api/resume/versions`

**Purpose:** List all resume versions for the current user.

**Response:**
```json
{
  "versions": [
    {
      "id": "uuid",
      "label": "Tailored for Google SWE",
      "opportunity": { "title": "SWE Intern", "company": "Google" },
      "created_at": "2026-06-19T10:00:00Z",
      "changes_count": 3
    }
  ]
}
```

---

## SECTION 8: UI DESIGN

### Optimizer Page Layout (`/resume/optimize`)

```
┌──────────────────────────────────────────────────────────────────┐
│  RESUME OPTIMIZER                                                │
│  Tailoring for: SWE Intern @ Google                             │
│                                                                  │
│  ┌────────────────────────────────┐ ┌──────────────────────────┐ │
│  │ YOUR RESUME                    │ │ MISSING SKILLS           │ │
│  │                                │ │ [Docker] [CI/CD] [K8s]   │ │
│  │ Experience                     │ │                          │ │
│  │ ├ Acme Corp, SWE               │ │ Click a bullet to        │ │
│  │ │  • Developed a web app...    │ │ improve it →             │ │
│  │ │    [✏️ Optimize]             │ │                          │ │
│  │ │  • Fixed bugs in backend     │ └──────────────────────────┘ │
│  │ │    [✏️ Optimize]             │                              │
│  │ └─────────────────────────     │                              │
│  └────────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

### Bullet Optimization Modal

When student clicks "✏️ Optimize":

```
┌─────────────────────────────────────────────────────┐
│  OPTIMIZE BULLET                    [Target: Docker] │
│                                                      │
│  Original:                                           │
│  "Developed a web application for inventory         │
│   management using Python and Flask."                │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  Alternative 1:                          [Use This]  │
│  "Engineered a containerized inventory              │
│   system using Python/Flask, ensuring               │
│   reproducible deployments."                         │
│                                                      │
│  Alternative 2:                          [Use This]  │
│  "Built and deployed an inventory management        │
│   web app with Docker-ready architecture."           │
│                                                      │
│  Alternative 3:                          [Use This]  │
│  "Developed a Flask-based inventory platform        │
│   applying containerization principles for          │
│   scalable delivery."                                │
│                                                      │
│  [Edit Before Saving]        [Keep Original]         │
└─────────────────────────────────────────────────────┘
```

### Component States

| State | Behaviour |
| :--- | :--- |
| Loading | Skeleton lines + spinner with "Generating alternatives..." |
| Success | 3 alternatives rendered with "Use This" buttons |
| Provider Fallback | Subtle badge: "Generated via backup provider" |
| Both Providers Failed | Error toast: "Could not generate alternatives. Try again." |
| Rate Limit Hit | Toast: "Daily limit reached (20 optimizations/day)" |

---

## SECTION 9: SECURITY

- **Authentication:** All routes require valid Supabase JWT. `user_id` from session only.
- **Ownership Check:** `resume_id` and `base_resume_id` are verified to belong to `auth.uid()` before processing.
- **Prompt Injection Guard:** `bullet_text` field is capped at 1,000 characters. HTML stripped server-side before insertion into prompt.
- **Output Sanitisation:** AI response is HTML-escaped before storage or display.
- **Rate Limiting:** 20 AI calls per user per day. Tracked via `optimizer_requests` count query on each request.
- **RLS:** `resume_versions` and `optimizer_requests` tables enforce row-level ownership.

---

## SECTION 10: COST ANALYSIS

### Gemini 1.5 Flash Pricing
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens

### Per-Request Estimate
- Prompt (system + user): ~250 tokens input
- Response (3 alternatives): ~150 tokens output
- Cost per request: (250 × $0.075 + 150 × $0.30) / 1,000,000 = **$0.000064**

### Monthly Projections

| Active Users | Optimizations/User/Month | Total Requests | Gemini Cost | Groq Cost |
| :--- | :--- | :--- | :--- | :--- |
| 100 | 20 | 2,000 | $0.13 | $0.00 (free tier) |
| 1,000 | 20 | 20,000 | $1.28 | $0.00 |
| 10,000 | 20 | 200,000 | $12.80 | $0.00 |

**Hard Cap:** Set a $20/month Gemini API budget alert. At 100 users, cost is negligible.

---

## SECTION 11: EDGE CASES

| Edge Case | Handling |
| :--- | :--- |
| Bullet is already excellent | AI still returns 3 alternatives. User can keep original. No forced change. |
| Bullet is a single word | Reject at API layer: minimum 5 words required. Show: "Please select a complete bullet point." |
| AI adds fabricated metrics | Fabrication guard catches it. Bullet is discarded. Retry once. |
| Both providers fail | Return 503. Show: "Generation failed. Try again in a moment." Never crash silently. |
| Student has no missing skills | Optimizer still works — student can pick any bullet to improve generically, without a target skill. |
| Prompt injection in bullet text | Strip HTML, cap at 1,000 chars, include system prompt safeguards. |
| Resume version limit (10) reached | Auto-delete oldest version before creating new. Warn user in UI. |

---

## SECTION 12: IMPLEMENTATION PLAN

**Estimated Effort:** 1.5 Weeks

1. **Days 1–2: AI Gateway + Prompt Module**
   - Set up AI Gateway abstraction (TDD-007 must be partially complete).
   - Implement prompt template builder.
   - Implement fabrication guard validator.
   - Unit test with 10 sample bullets.

2. **Days 3–4: Database + API**
   - Create `resume_versions` and `optimizer_requests` tables with RLS.
   - Implement `POST /api/resume/optimize`.
   - Implement `POST /api/resume/save-version`.
   - Implement `GET /api/resume/versions`.

3. **Days 5–8: UI**
   - Build Optimizer page with resume panel + missing skills sidebar.
   - Build bullet optimization modal with 3-alternative display.
   - Implement loading/error/rate-limit states.
   - Deep-link integration from ATS Engine "Improve Your Resume →" button.

4. **Days 9–11: Testing**
   - Test all edge cases from Section 11.
   - Validate fabrication guard with adversarial inputs.
   - Cost monitoring: verify `optimizer_requests` accurately tracks tokens.

**Dependencies:**
- TDD-001 (verified resume in DB)
- TDD-003 ATS Engine (provides `missing_skills[]`)
- TDD-007 AI Gateway (must exist before this)

---

## SECTION 13: CTO REVIEW

**Approved Decisions:**
- Gemini Flash as primary: correct. Best speed/cost/quality balance for short-form generation.
- Groq fallback: correct. Free tier at MVP scale, genuinely fast, different failure mode.
- Non-destructive versioning: non-negotiable. Students must never lose their original resume.
- Fabrication guard: non-negotiable. Legal and ethical requirement for a student platform.
- 20 calls/user/day rate limit: correct. Prevents abuse, cost stays predictable.

**Rejected Decisions:**
- GPT-4 as provider: too expensive (10× cost) for bullet rewrites. Rejected.
- Real-time streaming of bullet alternatives: adds UI complexity with minimal UX benefit at this scale. Rejected.
- Automatic bulk optimization of all bullets: fabrication risk is too high without human review of each bullet. Rejected.

**Risks:**
- Gemini API quota limits during free tier: Monitor and upgrade plan before launch.
- Students may accept AI-generated bullets without reading them: Cannot be prevented technically; mitigated by always showing original alongside alternatives.

**Verdict: ✅ Cleared for implementation.**
