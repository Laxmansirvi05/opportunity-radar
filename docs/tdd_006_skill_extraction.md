# TDD-006: Opportunity Skill Extraction Pipeline
**Project:** Opportunity Radar V2
**Stack:** Next.js 16, TypeScript, Supabase PostgreSQL
**AI Providers:** Gemini 1.5 Flash (primary), Groq / Llama-3 (fallback)
**Version:** 1.0

---

## SECTION 1: FEATURE OVERVIEW

### Purpose

The Recommendation Engine and ATS Engine both depend critically on `opportunities.extracted_skills[]` — a clean, normalised array of skills required for each opportunity. This pipeline is responsible for populating and maintaining that column for all 4,700+ existing opportunities and all future ingested opportunities.

This is a **background pipeline**, not a real-time user-facing feature. It runs asynchronously after opportunity ingestion and is invisible to students. Its output is what makes the entire Match Score and ATS system work.

### Two-Phase Extraction Strategy

**Phase 1 (Deterministic):** Parse structured `opportunity_tags` and existing `skills` fields using simple array normalisation. No AI needed. Covers ~60–70% of opportunities that already have structured skill data.

**Phase 2 (AI-Assisted):** For opportunities where structured skill data is absent or minimal (< 3 tags), send the `description` text to Gemini Flash to extract keywords. This covers the remaining 30–40%.

### Success Criteria

* > 95% of active opportunities have a non-empty `extracted_skills[]` after backfill.
* No single extraction call takes > 15 seconds.
* Extracted skills are lowercase and deduplicated.
* Cost per 1,000 AI extractions is under $0.10.

---

## SECTION 2: ARCHITECTURE

```
NEW OPPORTUNITY INGESTED
          ↓
┌─────────────────────────┐
│  Phase 1: Deterministic │
│  Extract from:          │
│  - opportunity_tags     │
│  - existing skills col  │
│  Normalise + Deduplicate│
└─────────────────────────┘
          ↓
  Has >= 5 skills?
    YES → Save extracted_skills, status = 'extracted'
    NO  ↓
┌─────────────────────────┐
│  Phase 2: AI Extraction │
│  Send description text  │
│  to Gemini Flash        │
│  Parse JSON response    │
│  Validate output        │
└─────────────────────────┘
          ↓
  Validation passed?
    YES → Merge with Phase 1 results, Save, status = 'extracted'
    NO  → Retry once → FAIL → status = 'extraction_failed', alert
```

---

## SECTION 3: PROCESSING PIPELINE

### Phase 1: Deterministic Extraction

```typescript
function extractDeterministic(opportunity: Opportunity): string[] {
  const skills: Set<string> = new Set()

  // Source 1: opportunity_tags (tag_name column)
  opportunity.opportunity_tags?.forEach(tag => {
    skills.add(normaliseSkill(tag.tag_name))
  })

  // Source 2: opportunity.skills column (if exists as text[] or JSON)
  opportunity.skills?.forEach(skill => {
    skills.add(normaliseSkill(skill))
  })

  return [...skills].filter(s => s.length > 1)
}

function normaliseSkill(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#+.\s-]/g, '')  // Remove special chars except common tech ones
    .replace(/\s+/g, ' ')
}
```

### Phase 2: AI-Assisted Extraction (Gemini Flash)

**When triggered:** Phase 1 result has < 5 skills AND description length > 100 characters.

**System Prompt:**
```
You are a technical skills extractor for a job opportunity database.

RULES:
1. Extract ONLY technical skills, tools, programming languages, frameworks, and domain knowledge explicitly mentioned in the text.
2. Do NOT extract soft skills (e.g., "communication", "teamwork").
3. Do NOT extract job titles, locations, or company names.
4. Output a JSON array of lowercase strings only.
5. Maximum 20 skills. If fewer are present, return fewer.
6. Respond ONLY with valid JSON. No explanations.

Example output: ["python", "sql", "react", "docker", "machine learning"]
```

**User Prompt:**
```
Extract technical skills from this job description:

{description_text}
```

**Response Parsing:**
```typescript
function parseAiSkills(rawResponse: string): string[] {
  try {
    const parsed = JSON.parse(rawResponse.trim())
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return parsed
      .filter(s => typeof s === 'string' && s.length > 1 && s.length < 50)
      .map(normaliseSkill)
      .slice(0, 20)
  } catch {
    return []  // Return empty on parse failure; triggers retry
  }
}
```

### Merge & Deduplication

```typescript
function mergeAndDeduplicate(phase1: string[], phase2: string[]): string[] {
  const merged = new Set([...phase1, ...phase2])
  return [...merged].sort()  // Sorted for deterministic storage
}
```

---

## SECTION 4: DATABASE DESIGN

### `opportunities` Table Changes

```sql
-- Already planned in Rec Engine TDD. Confirmed here:
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS extracted_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';
  -- extraction_status: 'pending' | 'extracted' | 'extraction_failed' | 'skipped'

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opp_extraction_status ON opportunities(extraction_status);
CREATE INDEX IF NOT EXISTS idx_opp_extracted_skills ON opportunities USING gin(extracted_skills);
```

### `extraction_log` Table (Monitoring + Audit)

```sql
CREATE TABLE extraction_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL,         -- 'deterministic' | 'ai'
  provider        TEXT,                  -- 'gemini' | 'groq' | null for phase 1
  skills_found    INT NOT NULL DEFAULT 0,
  tokens_used     INT,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extraction_log_opp ON extraction_log(opportunity_id);
CREATE INDEX idx_extraction_log_created ON extraction_log(created_at DESC);
```

---

## SECTION 5: VALIDATION LAYER

After AI extraction, every result passes through a validation layer before being stored:

```typescript
function validateExtractedSkills(skills: string[]): { valid: boolean; reason?: string } {
  if (skills.length === 0) return { valid: false, reason: 'Empty result' }
  if (skills.length > 25) return { valid: false, reason: 'Too many skills (max 25)' }

  for (const skill of skills) {
    if (skill.length < 2)  return { valid: false, reason: `Skill too short: "${skill}"` }
    if (skill.length > 60) return { valid: false, reason: `Skill too long: "${skill}"` }
    if (/^\d+$/.test(skill)) return { valid: false, reason: `Numeric-only skill: "${skill}"` }
  }

  // Check for obvious hallucinations (skills that are clearly not skills)
  const blocklist = ['the', 'and', 'for', 'with', 'this', 'that', 'you', 'are']
  for (const skill of skills) {
    if (blocklist.includes(skill)) return { valid: false, reason: `Blocklisted word: "${skill}"` }
  }

  return { valid: true }
}
```

---

## SECTION 6: RETRY LOGIC

```
AI call fails (timeout or invalid JSON)
  ↓
Retry once with same prompt (wait 2 seconds)
  ↓
  SUCCESS → proceed
  FAIL    → Try Groq fallback
              SUCCESS → proceed
              FAIL    → Set extraction_status = 'extraction_failed'
                        Log to extraction_log with error
                        Alert monitoring (future: Slack webhook)
```

**Max retries per opportunity:** 2 (1 Gemini retry + 1 Groq attempt).
**Do not retry extraction_failed opportunities automatically** — requires manual review or a scheduled weekly retry job.

---

## SECTION 7: BACKFILL MIGRATION PLAN

The backfill must process all 4,700+ existing opportunities safely.

### Backfill Script Architecture

```typescript
// scripts/backfill-extracted-skills.ts
async function runBackfill() {
  const BATCH_SIZE = 50
  const DELAY_MS = 1000  // 1s delay between batches to avoid rate limits

  let offset = 0
  while (true) {
    const batch = await supabase
      .from('opportunities')
      .select('id, skills, description')
      .eq('extraction_status', 'pending')
      .limit(BATCH_SIZE)
      .order('created_at', { ascending: true })

    if (batch.data?.length === 0) break

    for (const opp of batch.data ?? []) {
      await extractAndSave(opp)
      await sleep(100)  // 100ms per record to spread load
    }

    offset += BATCH_SIZE
    await sleep(DELAY_MS)
  }
}
```

**Estimated Backfill Time:**
- 4,700 opportunities ÷ 50 per batch = 94 batches
- ~60% Phase 1 only (fast): 2,820 records × 100ms = ~5 minutes
- ~40% need AI (2s per record): 1,880 records × 2s = ~63 minutes
- **Total estimated backfill time: ~70 minutes** (run as a one-time background script)

---

## SECTION 8: MONITORING

### Key Metrics to Track

| Metric | Target | Alert If |
| :--- | :--- | :--- |
| `extraction_status = 'pending'` count | 0 after backfill | > 100 pending for > 24h |
| `extraction_status = 'extraction_failed'` count | < 2% of total | > 5% |
| Average AI extraction latency | < 3s | > 8s P95 |
| AI cost per day | < $0.50 | > $2.00 |

### Monitoring Queries

```sql
-- Daily extraction health check
SELECT
  extraction_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct
FROM opportunities
GROUP BY extraction_status;

-- Daily AI cost estimate
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS requests,
  SUM(tokens_used) AS total_tokens,
  ROUND(SUM(tokens_used) * 0.000000075, 4) AS estimated_cost_usd
FROM extraction_log
WHERE phase = 'ai' AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## SECTION 9: COST ANALYSIS

### Per-Record AI Cost (Gemini Flash)

- Input tokens per extraction: ~300 (system prompt + description)
- Output tokens per extraction: ~50 (skills array)
- Cost: (300 × $0.075 + 50 × $0.30) / 1,000,000 = **$0.000038 per record**

### Total Backfill Cost

- ~1,880 records requiring AI: 1,880 × $0.000038 = **$0.07 total** (seven cents)

### Ongoing Cost (New Opportunities Per Day)

- Assuming 50 new opportunities/day, 40% requiring AI = 20 records
- 20 × $0.000038 = **$0.00076/day** (~$0.023/month)

**Conclusion:** Skill extraction is essentially free. No cost concern at MVP scale.

---

## SECTION 10: FAILURE HANDLING

| Failure Mode | Response |
| :--- | :--- |
| Gemini API down | Retry once → Groq fallback → mark `extraction_failed` |
| Description is too short (< 50 chars) | Skip AI, store Phase 1 results only, mark `skipped` |
| AI returns non-JSON | Parse failure → retry → fallback → `extraction_failed` |
| Extracted skills array is empty after both phases | Mark `extraction_failed` — opportunity will not appear in personalised feed until fixed |
| Rate limit hit on Gemini API | Exponential backoff: wait 5s, 15s, 60s before marking failed |

---

## SECTION 11: IMPLEMENTATION PLAN

**Estimated Effort:** 1 Week

1. **Days 1–2: Core Extraction Module**
   - Write `extractDeterministic()`, `normaliseSkill()`, `parseAiSkills()`, `validateExtractedSkills()`.
   - Unit tests for all edge cases.

2. **Day 3: Database Changes**
   - Add `extraction_status` column to `opportunities`.
   - Create `extraction_log` table.
   - Ensure GIN index exists on `extracted_skills`.

3. **Days 4–5: Pipeline + API Gateway Integration**
   - Wire pipeline to AI Gateway (TDD-007).
   - Write retry and fallback logic.
   - Write backfill script.

4. **Days 6–7: Backfill + Monitoring**
   - Run backfill script in controlled batches.
   - Verify output quality on 50 random opportunities.
   - Set up monitoring SQL queries as a daily cron.

**Dependencies:**
- TDD-007 (AI Gateway must exist before Phase 2 can run)
- `extracted_skills` column must exist on `opportunities` (from Rec Engine TDD)

---

## SECTION 12: CTO REVIEW

**Approved:**
- Two-phase strategy (deterministic first, AI second): correct. Maximises coverage while minimising AI costs.
- Backfill as an offline script, not a migration: correct. Migrations should be fast; backfill takes 70 minutes.
- `extraction_log` table: correct. Without it, cost and failure visibility are blind.
- Groq as fallback: correct. Different infrastructure = true redundancy.

**Rejected:**
- Real-time extraction on opportunity ingestion: adds latency to the ingestion pipeline. Background processing is correct.
- Semantic/embedding-based extraction: over-engineered. Keyword extraction from structured job text is a solved problem with simple prompts.

**Risks:**
- AI hallucinating skills not in the description: mitigated by explicit system prompt rule and validation layer.
- Gemini quota exhaustion during backfill: mitigated by batching with delays.

**Verdict: ✅ Cleared for implementation. Run backfill before launching the Recommendation Engine or ATS Engine.**
