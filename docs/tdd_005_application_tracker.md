# TDD-005: Enhanced Application Tracker
**Project:** Opportunity Radar V2
**Stack:** Next.js 16, TypeScript, Tailwind, Supabase PostgreSQL
**Version:** 1.0

---

## SECTION 1: FEATURE OVERVIEW

### Purpose

The Application Tracker is the student's application command center. Every opportunity the student has saved or applied for lives here, organized into a 5-stage Kanban board. It captures ATS and Match scores at the moment of application, tracks a notes and activity timeline, and gives the student a clear picture of where they stand across all their active applications.

### User Flow

1. Student saves an opportunity from the feed → card appears in "Saved" column.
2. Student applies externally → drags card to "Applied" column. System snapshots the current ATS Score and Match Score.
3. Student gets an interview → drags card to "Interview" column. System logs the timestamp.
4. Student receives an offer or rejection → moves to final column. Application is complete.
5. At any stage, student can open a card to add notes, view the full timeline, and see the score snapshot from when they applied.

### Business Value

* Creates the feedback loop: students can correlate match scores with outcomes over time.
* High-value data for future university placement dashboards (aggregated, anonymised).
* Increases daily active usage — students return to track progress.

### Success Criteria

* Drag-and-drop works on both desktop and mobile.
* ATS Score and Match Score are snapshotted at the moment of "Applied" stage, never recalculated after.
* Notes are saved in < 1 second with optimistic UI.
* Board loads in < 1 second for up to 200 tracked applications.

---

## SECTION 2: DATABASE DESIGN

### `applications` Table (Primary)

```sql
CREATE TYPE application_stage AS ENUM (
  'saved', 'applied', 'interview', 'offer', 'rejected'
);

CREATE TABLE applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id        UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  stage                 application_stage NOT NULL DEFAULT 'saved',

  -- Score snapshots (captured at 'applied' stage, never updated after)
  ats_score_snapshot    INT,
  match_score_snapshot  INT,
  resume_version_id     UUID REFERENCES resume_versions(id) ON DELETE SET NULL,

  -- Application metadata
  applied_at            TIMESTAMPTZ,
  notes                 TEXT,
  custom_label          TEXT,      -- e.g., "Dream job", "Safety net"

  -- Position tracking for Kanban column ordering
  column_position       INT NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, opportunity_id)  -- One tracker entry per opportunity per user
);

CREATE INDEX idx_applications_user_stage ON applications(user_id, stage);
CREATE INDEX idx_applications_user_created ON applications(user_id, created_at DESC);
```

### `application_events` Table (Timeline / Audit Log)

```sql
CREATE TABLE application_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  -- event_types: 'stage_change', 'note_added', 'note_edited', 'score_snapshot'
  payload         JSONB NOT NULL DEFAULT '{}',
  -- payload example: { "from": "saved", "to": "applied", "ats_score": 72 }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_events_application ON application_events(application_id, created_at ASC);
```

### RLS Policies

```sql
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_own" ON applications
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_own" ON application_events
  FOR ALL USING (auth.uid() = user_id);
```

---

## SECTION 3: API DESIGN

### `GET /api/tracker`

**Purpose:** Fetch all applications for the current user, grouped by stage.

**Response:**
```json
{
  "board": {
    "saved":     [{ "id": "uuid", "opportunity": {...}, "column_position": 0, "ats_score_snapshot": null }],
    "applied":   [{ "id": "uuid", "opportunity": {...}, "ats_score_snapshot": 72, "match_score_snapshot": 85, "applied_at": "..." }],
    "interview": [],
    "offer":     [],
    "rejected":  []
  }
}
```

---

### `POST /api/tracker/save`

**Purpose:** Save an opportunity (create a tracker entry in "saved" stage).

**Request:** `{ "opportunity_id": "uuid" }`
**Response:** `{ "application_id": "uuid" }`

---

### `PATCH /api/tracker/:id/stage`

**Purpose:** Move a card to a new stage (the primary drag-and-drop endpoint).

**Request:**
```json
{
  "stage": "applied",
  "column_position": 2
}
```

**Processing:**
1. Update `applications.stage` and `column_position`.
2. If `stage = 'applied'`:
   - Fetch current `ats_score` and `match_score` from ATS Engine and Rec Engine for this user + opportunity pair.
   - Write to `ats_score_snapshot` and `match_score_snapshot`.
   - Set `applied_at = NOW()`.
3. Insert an `application_events` row with `event_type = 'stage_change'`.

**Response:** `{ "success": true, "snapshots": { "ats_score": 72, "match_score": 85 } }`

---

### `PATCH /api/tracker/:id/notes`

**Purpose:** Save or update notes on a card.

**Request:** `{ "notes": "Had a great screening call. Follow up by Friday." }`
**Response:** `{ "success": true }`

---

### `GET /api/tracker/:id/timeline`

**Purpose:** Fetch the full event timeline for a specific application.

**Response:**
```json
{
  "events": [
    { "event_type": "stage_change", "payload": { "from": "saved", "to": "applied" }, "created_at": "..." },
    { "event_type": "note_added", "payload": { "note": "Great screening call." }, "created_at": "..." }
  ]
}
```

---

### `DELETE /api/tracker/:id`

**Purpose:** Remove an application from the tracker entirely.

**Processing:** Soft delete (set `stage = 'archived'`) to preserve event history. Hard delete on explicit request.

---

## SECTION 4: KANBAN ARCHITECTURE

### State Management Strategy

All Kanban board state is managed client-side in React via a local state object that mirrors the server's `board` shape. Optimistic updates are applied immediately on drag-and-drop; the API call runs in the background. If the API call fails, the card snaps back with an error toast.

```
User drags card from "Saved" → "Applied"
  ↓
Optimistic update: UI moves card immediately
  ↓
PATCH /api/tracker/:id/stage { stage: "applied" }
  ↓
  SUCCESS → Merge snapshots into local state
  FAIL    → Revert card to original position + error toast
```

### Drag-and-Drop Library

**Recommended:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Why dnd-kit over react-beautiful-dnd?**
- Actively maintained (react-beautiful-dnd is deprecated).
- Full TypeScript support.
- Works with touch events (mobile drag-and-drop).
- No external DOM manipulation.

### Column Ordering

`column_position` is a simple integer. When a card is dropped into a column, all cards in that column are reordered:
- Use a "gap strategy": assign positions 0, 100, 200, 300... so insertions don't require reindexing.
- On drop: set the dropped card's position to the midpoint between the card above and below it.
- If the gap becomes too small (< 1), re-normalise all positions in that column in a single batch update.

---

## SECTION 5: UI DESIGN

### Tracker Page Layout (`/tracker`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ APPLICATION TRACKER                        [+ Add Application]      │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │  SAVED   │  │ APPLIED  │  │INTERVIEW │  │  OFFER   │  │ REJ. │ │
│  │  (12)    │  │  (8)     │  │  (3)     │  │  (1)     │  │  (5) │ │
│  │          │  │          │  │          │  │          │  │      │ │
│  │ [Card]   │  │ [Card]   │  │ [Card]   │  │ [Card]   │  │[Card]│ │
│  │ [Card]   │  │ [Card]   │  │ [Card]   │  │          │  │      │ │
│  │ [Card]   │  │          │  │          │  │          │  │      │ │
│  │          │  │          │  │          │  │          │  │      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Application Card

```
┌──────────────────────────────┐
│ [Logo] Company Name          │
│        Role Title            │
│        📍 Remote  💰 Paid   │
│                              │
│ ATS: [72%]  Match: [85%]     │  ← Shown only in Applied+ stages
│                              │
│ Applied: Jun 12              │  ← Shown in Applied+ stages
│ [📝 Notes] [→ View Job]      │
└──────────────────────────────┘
```

### Application Detail Drawer (Opens on card click)

```
┌─────────────────────────────────────────┐
│  Frontend Engineer Intern @ Google      │
│  Stage: ● Applied                       │
│                                         │
│  SCORE SNAPSHOT (at time of applying)   │
│  ATS Score:   72% | Match Score: 85%    │
│  Resume Used: "Google Tailored" v2      │
│                                         │
│  NOTES                                  │
│  ┌─────────────────────────────────┐    │
│  │ Great first call. Follow up...  │    │
│  └─────────────────────────────────┘    │
│  [Save Note]                            │
│                                         │
│  TIMELINE                               │
│  Jun 10 → Saved                        │
│  Jun 12 → Applied (ATS: 72%)           │
│  Jun 14 → Note added                   │
└─────────────────────────────────────────┘
```

---

## SECTION 6: STATE MANAGEMENT

### Client State Shape

```typescript
type Board = {
  saved:     Application[]
  applied:   Application[]
  interview: Application[]
  offer:     Application[]
  rejected:  Application[]
}

type Application = {
  id: string
  opportunity: OpportunityWithDetails
  stage: ApplicationStage
  column_position: number
  ats_score_snapshot: number | null
  match_score_snapshot: number | null
  applied_at: string | null
  notes: string | null
  resume_version_id: string | null
}
```

### Data Fetching

- Load full board on page mount via `GET /api/tracker`.
- Use `SWR` or React Query with `staleTime: 60s` — board data changes infrequently.
- Optimistic updates for stage changes and note saves.

---

## SECTION 7: SECURITY

- All tracker endpoints require valid Supabase JWT session.
- `user_id` extracted from session server-side. Never accepted from client.
- RLS enforced on both `applications` and `application_events`.
- `opportunity_id` existence is verified via FK constraint before insert.
- Rate limit: 100 stage-change requests per user per hour (prevents automated scraping via the tracker API).

---

## SECTION 8: PERFORMANCE

### Board Load Time

- Single query fetching all applications for a user, joined with opportunity data.
- Index `idx_applications_user_stage` ensures fast retrieval.
- Up to 200 cards: < 100ms DB query, < 300ms total page load.

### Snapshot Fetching at "Applied" Stage

- ATS snapshot: Call `/api/ats/analyze` server-side within the PATCH handler. Not a separate client call.
- Match snapshot: Read from `user_opportunity_matches` cache if available, else call RPC. This is a single primary key lookup.
- Both happen synchronously within the PATCH handler. Response includes snapshots.

### Column Reordering

- Full column reorder is a batch `UPDATE applications SET column_position = ... WHERE id IN (...)`.
- Max column size: 50 cards (soft limit). Beyond 50, paginate within column.

---

## SECTION 9: EDGE CASES

| Edge Case | Handling |
| :--- | :--- |
| User saves same opportunity twice | `UNIQUE(user_id, opportunity_id)` constraint returns conflict. UI shows "Already in your tracker." |
| Drag-and-drop fails (network error) | Optimistic update reverted. Card snaps back. Error toast shown. |
| ATS score unavailable at apply time | Snapshot stored as `null`. Card shows "Score unavailable at apply time." |
| Opportunity is deleted from DB | `ON DELETE CASCADE` removes the application. Or use `ON DELETE SET NULL` on `opportunity_id` if history should be preserved. |
| Student has 0 applications | Board renders empty columns with empty state illustration and "Start by saving opportunities" CTA. |
| 200+ applications | Pagination within columns. Load 50 per column, "Load more" button. |

---

## SECTION 10: IMPLEMENTATION PLAN

**Estimated Effort:** 1.5 Weeks

1. **Days 1–2: Database**
   - Create `applications` and `application_events` tables with RLS.
   - Write and test all 5 API routes.

2. **Days 3–5: Core Kanban UI**
   - Install and configure `@dnd-kit`.
   - Build `Board`, `Column`, and `Card` components.
   - Implement drag-and-drop with optimistic updates.

3. **Days 6–8: Score Snapshots + Timeline**
   - Integrate ATS and Match score fetching in the PATCH handler.
   - Build Application Detail Drawer with Notes and Timeline sections.

4. **Days 9–11: Polish + Testing**
   - Mobile drag-and-drop testing.
   - Edge case testing (duplicate save, network failure, empty state).
   - Performance test with 100 seeded applications.

**Dependencies:**
- TDD-001 (resumes exist)
- TDD-002 (Match Score available)
- TDD-003 (ATS Score available)
- TDD-004 (`resume_versions` table for snapshot linkage)

---

## SECTION 11: CTO REVIEW

**Approved:**
- dnd-kit over react-beautiful-dnd: correct. RBD is deprecated.
- Snapshot-on-apply strategy: non-negotiable. Scores must be frozen at apply time for data integrity.
- Optimistic UI for drag-and-drop: correct. Latency-sensitive interaction; optimistic is the right pattern.
- `application_events` audit table: correct. Foundation for future placement dashboard analytics.

**Rejected:**
- Auto-email reminders for follow-ups: out of MVP scope. Infrastructure not in place.
- AI-generated application notes: out of MVP scope.
- Bulk import from LinkedIn: out of MVP scope.

**Risks:**
- Column position integer overflow: mitigated by gap strategy (positions in multiples of 100, re-normalise when gap < 1).
- Touch drag-and-drop UX on mobile can be finicky: allocate dedicated mobile testing time.

**Verdict: ✅ Cleared for implementation.**
