# Technical Requirements Document (TRD): Opportunity Radar
**Version:** 1.0  
**Status:** Final — Ready for Implementation  
**Derived From:** PRD v1.0 (June 2026)  
**Author:** Architecture Review

---

## Table of Contents
1. [Technical Executive Summary](#1-technical-executive-summary)
2. [Final Architecture Recommendation](#2-final-architecture-recommendation)
3. [Frontend Stack](#3-frontend-stack)
4. [Backend Stack](#4-backend-stack)
5. [Database Design](#5-database-design)
6. [Authentication and Authorization](#6-authentication-and-authorization)
7. [Search and Filtering Design](#7-search-and-filtering-design)
8. [API Design](#8-api-design)
9. [Data Schema Design](#9-data-schema-design)
10. [Security Architecture](#10-security-architecture)
11. [Rate Limiting and Abuse Prevention](#11-rate-limiting-and-abuse-prevention)
12. [Deployment and Hosting](#12-deployment-and-hosting)
13. [Environment Variables](#13-environment-variables)
14. [Folder Structure](#14-folder-structure)
15. [Performance Strategy](#15-performance-strategy)
16. [Backup, Recovery, and Observability](#16-backup-recovery-and-observability)
17. [Error Handling](#17-error-handling)
18. [Implementation Phases](#18-implementation-phases)
19. [Risks and Tradeoffs](#19-risks-and-tradeoffs)
20. [Future Upgrade Path](#20-future-upgrade-path)
21. [Final Recommended Stack](#21-final-recommended-stack)
22. [Ready-for-Build Checklist](#22-ready-for-build-checklist)

---

## 1. Technical Executive Summary

Opportunity Radar is a student-first opportunity aggregation and tracking platform. The MVP must be built by a solo developer, deployed at zero cost, and remain maintainable and scalable as usage grows.

**The guiding architecture principle is: choose the fewest moving parts that can still become a serious product.**

The selected stack is a **Next.js 14 (App Router) + Supabase** monorepo. This combination delivers:
- A single codebase for frontend and backend (no separate API server to maintain)
- A fully managed PostgreSQL database with built-in auth, Row Level Security, storage, and realtime
- Free-tier hosting on Vercel and Supabase sufficient for the entire MVP
- Zero infrastructure management for a solo developer on a MacBook M4

**One pre-build clarification required from the PRD:**  
The PRD lists "Resume Toolkit Integration" as in-scope. Before Sprint 1, a technical spike must determine whether the Resume Toolkit is embeddable. If not, it will be surfaced as a simple external link with a button: "Open Resume Toolkit." This decision must be made before any routing or component work begins. It does not block any other feature.

---

## 2. Final Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL (Free Hobby)                  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Next.js 14 App Router (TypeScript)        │   │
│   │                                                     │   │
│   │  Server Components  →  Data Fetching (no API hop)   │   │
│   │  Client Components  →  Interactivity only           │   │
│   │  Route Handlers     →  Form mutations, webhooks     │   │
│   │  Middleware          →  Auth guard, role check      │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Supabase JS SDK
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE (Free Tier)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL  │  │  Supabase    │  │  Supabase        │   │
│  │  (Database)  │  │  Auth        │  │  Storage         │   │
│  │  + RLS       │  │  (JWT/OAuth) │  │  (logos only)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Supabase Edge Functions (Deno)                     │    │
│  │  Used for: cron-based lifecycle jobs only           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Why not Firebase?**  
Firebase uses a NoSQL (Firestore) data model. Opportunity Radar has deeply relational data: opportunities → companies, opportunities → tags, users → bookmarks → opportunities, audit logs → actors → targets. Modeling this in Firestore requires denormalization and duplicated writes that will become painful at even modest scale. PostgreSQL is the correct choice. Supabase gives us PostgreSQL plus all the managed services Firebase offers, but with SQL.

**Why not a custom Express backend?**  
An Express backend adds a separate deployment target, separate hosting bill (Railway/Render free tiers have sleep delays), separate environment management, and a CORS configuration layer. For an MVP with a solo developer, this is unjustifiable complexity. Next.js Route Handlers can serve every API need in this product.

**Why not plain Vercel Postgres?**  
Vercel Postgres is a good database, but it does not include managed auth, storage, RLS, or Edge Functions. Supabase gives all of these at zero cost. Adding separate auth (Auth0/Clerk free tiers have strict limits) and storage (S3 has no permanent free tier) would complicate the stack for no benefit.

---

## 3. Frontend Stack

### Core Framework
**Next.js 14 with App Router — TypeScript — Tailwind CSS — shadcn/ui**

| Property | Decision |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Component Library | shadcn/ui (copy-paste, not a package dependency) |
| State Management | React built-in state + Zustand for lightweight global state (notifications badge count, auth user) |
| Data Fetching | Server Components for initial loads; SWR for client-side revalidation |
| Forms | React Hook Form + Zod for validation |

### Server Components vs Client Components — Decision Rules

This is the most important architectural decision in a Next.js 14 app. The wrong default direction causes either unnecessary client-side JavaScript bundles or broken interactivity.

**Use Server Components for:**
- Opportunity Hub listing page (read-only, SEO-critical, benefits from server-side rendering)
- Company profile pages (static-ish content, good for caching)
- Any page that fetches data and displays it without user interaction
- Admin dashboard data tables (fast initial load matters)

**Use Client Components for:**
- Search input and filter dropdowns (require onChange event listeners)
- Bookmark button (requires onClick + optimistic UI)
- Application Tracker Kanban board (drag/drop or status change)
- Notification bell and panel (real-time read state)
- Any form (submission, login, profile edit)
- Countdown timer display (interval-based updates)

**Rule of thumb:** Start as a Server Component. Only add `"use client"` when you need `useState`, `useEffect`, event handlers, or browser APIs.

### Routing Structure

```
app/
├── (public)/                 ← No auth required
│   ├── page.tsx              ← Landing page / Opportunity Hub
│   ├── opportunities/[id]/   ← Opportunity detail
│   └── companies/[id]/       ← Company profile
├── (auth)/                   ← Auth pages (no layout chrome)
│   ├── login/
│   └── signup/
├── (protected)/              ← Requires valid session
│   ├── dashboard/            ← Student dashboard
│   ├── tracker/              ← Application tracker
│   ├── notifications/        ← Notification center
│   ├── profile/              ← Profile edit
│   └── submit/               ← Community submission form
├── (admin)/                  ← Requires Admin or Moderator role
│   ├── admin/
│   │   ├── opportunities/    ← CRUD opportunities
│   │   ├── submissions/      ← Moderation queue
│   │   ├── companies/        ← Company management
│   │   ├── users/            ← User management (Admin only)
│   │   └── audit-log/        ← Audit log viewer (Admin only)
└── api/                      ← Route Handlers
```

**Middleware** (`middleware.ts` in project root) intercepts every request and:
1. Checks for a valid Supabase session cookie
2. Reads the user's `role` from the session claims
3. Redirects unauthenticated users from protected routes to `/login`
4. Returns 403 for role-unauthorized routes (e.g., a Student hitting `/admin/users/`)

---

## 4. Backend Stack

**Platform:** Next.js Route Handlers + Supabase  
**No separate backend server.** All API logic lives in `app/api/` Route Handlers.

### What Route Handlers Handle
- Mutations that require server-side validation (form submissions, bookmark toggles, tracker updates)
- Sensitive operations (role changes, account deletion)
- Rate-limit-checked endpoints (community submission)
- Webhook-style callbacks if needed

### What Supabase Edge Functions Handle
- **Cron Job 1:** `expire-opportunities` — runs daily at 00:00 UTC. Sets status = `Expired` where `deadline < NOW()` and status = `Published` or `Closing Soon`.
- **Cron Job 2:** `flag-closing-soon` — runs every 15 minutes. Sets status = `Closing Soon` where `deadline - NOW() <= 48 hours` and status = `Published`. Creates `DeadlineAlert` notifications for users who have it bookmarked and haven't moved past `Saved`.
- **Cron Job 3:** `stale-tracker-reminder` — runs daily. Finds tracker entries where `status = 'Saved'` and `saved_at < NOW() - 7 days` and no `StaleTracker` notification exists yet. Creates notification.
- **Cron Job 4:** `escalate-stale-submissions` — runs every hour. Finds submissions in `Pending Review` status for > 48 hours. Writes `MODERATION_ESCALATED` to audit log.
- **Cron Job 5:** `purge-deleted-accounts` — runs daily. Finds users where `deleted_at < NOW() - 30 days`. Purges PII. Anonymizes tracker entries.

> **Free Tier Note:** Supabase Edge Functions run on Deno and have a generous free tier (500,000 invocations/month). Five lightweight cron jobs running daily/15-min will use fewer than 5,000 invocations per month.

### Why Not Vercel Cron Jobs?
Vercel Hobby plan allows cron jobs but limits them to once per day. Two of the required cron jobs (flag-closing-soon runs every 15 min; escalate-stale-submissions runs hourly) require sub-daily frequency. Supabase Edge Function crons have finer scheduling. Use Supabase crons for all five jobs.

---

## 5. Database Design

**PostgreSQL via Supabase — the correct and only choice for this product.**

### Why PostgreSQL
- All opportunity data is structured and relational (opportunities → companies, tags → opportunities)
- Search is implemented via `tsvector` full-text search — a native PostgreSQL feature
- Row Level Security (RLS) provides authorization at the database layer, not just the application layer
- Supabase wraps PostgreSQL with a REST API (PostgREST), realtime subscriptions, and migrations tooling

### Free Tier Limits
| Limit | Supabase Free Tier |
|---|---|
| Database size | 500 MB |
| Storage | 1 GB |
| Bandwidth | 5 GB/month |
| Edge Function invocations | 500,000/month |
| Auth users | Unlimited |
| Projects | 2 |

500 MB is sufficient for well into 100,000 opportunities and 50,000 users. The primary risk is the bandwidth cap. A 5GB/month bandwidth limit supports approximately 500,000 API calls serving 10KB payloads. With aggressive Next.js caching on public routes, this is not a concern for MVP.

### Database Indexing Strategy
The following indexes are mandatory before the first data insert:

```sql
-- Opportunity queries (the most frequent read path)
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_posted_at ON opportunities(posted_at DESC);
CREATE INDEX idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX idx_opportunities_mode ON opportunities(mode);
CREATE INDEX idx_opportunities_is_paid ON opportunities(is_paid);

-- Full-text search
CREATE INDEX idx_opportunities_fts ON opportunities USING gin(
  to_tsvector('english', title || ' ' || coalesce(description, ''))
);

-- Composite: the Fresh Feed query
CREATE INDEX idx_opportunities_fresh ON opportunities(posted_at DESC, status)
  WHERE status = 'Published';

-- Composite: Closing Soon query
CREATE INDEX idx_opportunities_closing ON opportunities(deadline, status)
  WHERE status IN ('Published', 'Closing Soon');

-- Tracker
CREATE INDEX idx_tracker_user_id ON application_tracker(user_id);
CREATE INDEX idx_tracker_status ON application_tracker(status);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
  WHERE is_read = FALSE;

-- Audit log
CREATE INDEX idx_audit_log_performed_at ON audit_log(performed_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
```

---

## 6. Authentication and Authorization

### Authentication: Supabase Auth

**Decision: Supabase Auth. No exceptions for MVP.**

| Property | Implementation |
|---|---|
| Email/Password signup | Supabase Auth built-in |
| OAuth (Google) | Supabase Auth built-in — recommended as primary method for students |
| Session management | JWT issued by Supabase, stored in `httpOnly` cookies by the Supabase SSR helper |
| Session duration | 7 days; refreshed automatically on activity |
| Password reset | Supabase Auth magic link flow (email) — this is the ONE place email is used, handled entirely by Supabase |
| Account deletion | Soft delete on the `profiles` table; actual auth user deletion deferred to the 30-day purge cron |

**Supabase Auth + Next.js Integration:** Use `@supabase/ssr` package. This creates server-side session helpers for Server Components, Route Handlers, and Middleware from the same cookie. This is the official approach and avoids the `localStorage` session trap.

### Authorization: Role-Based Access Control (RBAC)

**Implementation:** The user's role (`student`, `moderator`, `admin`) is stored in the `profiles` table. It is NOT stored in the JWT claims directly (Supabase does not make this straightforward). Instead:

1. On session creation/refresh, Middleware reads the Supabase user ID from the session cookie.
2. Middleware fetches the `role` from the `profiles` table (a fast indexed lookup).
3. The role is stored in a Next.js middleware-controlled response header that Server Components can read without another DB call.
4. **Alternative (preferred):** Use Supabase's custom `app_metadata` to store the role, set server-side only. This makes the role available in JWT claims and avoids the extra DB lookup.

**Row Level Security (RLS):** RLS is the authorization safety net at the database layer. Even if the application layer has a bug, RLS prevents data leakage.

```sql
-- Example: Students can only read/write their own tracker entries
CREATE POLICY "Users can manage own tracker entries"
  ON application_tracker
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Example: Published opportunities are readable by everyone (including unauthenticated)
CREATE POLICY "Anyone can view published opportunities"
  ON opportunities
  FOR SELECT
  USING (status IN ('Published', 'Closing Soon'));

-- Example: Only Admins can insert/update/delete opportunities directly
CREATE POLICY "Admins can manage opportunities"
  ON opportunities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Example: Audit log is insert-only from service role; read-only for admins
CREATE POLICY "Admins can read audit log"
  ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

> **Important:** The `audit_log` table must be written to using the **Supabase service role key** (server-side only, never exposed to the browser) to bypass RLS for inserts from cron jobs and Route Handlers.

---

## 7. Search and Filtering Design

### Decision: PostgreSQL Full-Text Search + Indexed Column Filters

**No external search engine (Algolia, Elasticsearch, Typesense) in MVP.** These are paid services or require self-hosting. PostgreSQL's native full-text search is sufficient for 10,000–50,000 opportunities.

### Text Search Implementation

```sql
-- Search query example (built by the Route Handler, never raw user input)
SELECT *
FROM opportunities
WHERE status IN ('Published', 'Closing Soon')
  AND to_tsvector('english', title || ' ' || coalesce(description, ''))
      @@ plainto_tsquery('english', $1)
ORDER BY posted_at DESC
LIMIT 20 OFFSET $2;
```

`plainto_tsquery` safely converts user input (spaces become AND operators). It does NOT require parameterized query escaping beyond standard `$1` binding — safe from SQL injection.

### Filter Implementation

Filters are applied as `WHERE` clause additions, built server-side from validated query parameters:

| Filter | Column | Type |
|---|---|---|
| Category | `category` | ENUM equality |
| Mode | `mode` | ENUM equality |
| Is Paid | `is_paid` | Boolean |
| Deadline (Fresh Feed) | `posted_at >= NOW() - INTERVAL` | Timestamp range |
| Closing Soon | `status = 'Closing Soon'` | Status filter |
| Experience Level | `experience_level` | ENUM equality |
| Company | `company_id` | UUID equality |

Filters are **always combined with `status IN ('Published', 'Closing Soon')`** to prevent expired/draft opportunities from leaking into results.

### Skill Tags Filter

Skill tags are stored in a separate `opportunity_tags` join table (many-to-many). Tag filtering uses:

```sql
SELECT DISTINCT o.*
FROM opportunities o
JOIN opportunity_tags ot ON ot.opportunity_id = o.id
WHERE ot.tag_name = ANY($1::text[])  -- array of selected tags
  AND o.status IN ('Published', 'Closing Soon');
```

### Fresh Feed Query

```sql
SELECT * FROM opportunities
WHERE status IN ('Published', 'Closing Soon')
  AND posted_at >= NOW() - INTERVAL '24 hours'  -- parameterized by time-box selection
ORDER BY posted_at DESC
LIMIT 20;
```

Time-box values: `1 hour`, `6 hours`, `24 hours`, `7 days`. Validated server-side against an allowlist.

### Future Upgrade Path

When the opportunity count exceeds ~50,000 and search latency becomes perceptible:
- Add **Typesense** (open-source, self-hostable, generous free cloud tier) as a search index layer
- Supabase triggers can sync new/updated opportunities to Typesense on write
- This upgrade does not require any schema changes — it is purely an additive layer

---

## 8. API Design

All API routes are **Next.js Route Handlers** (`app/api/.../route.ts`). All requests must:
1. Validate the session (except public GET endpoints)
2. Validate all inputs with Zod
3. Return consistent JSON response shapes
4. Write to the audit log for all admin/moderator mutations

### Standard Response Shape

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: string, message: string } }
```

### Route Inventory

#### Public Routes (No Auth Required)
| Method | Route | Description |
|---|---|---|
| GET | `/api/opportunities` | List published opportunities (with filters via query params) |
| GET | `/api/opportunities/[id]` | Get single opportunity detail |
| GET | `/api/opportunities/fresh` | Fresh Feed (time-boxed) |
| GET | `/api/companies/[id]` | Company profile + active opportunities |

#### Authenticated Routes (Student+)
| Method | Route | Description |
|---|---|---|
| POST | `/api/bookmarks` | Add bookmark |
| DELETE | `/api/bookmarks/[id]` | Remove bookmark |
| GET | `/api/bookmarks` | List user's bookmarks |
| GET | `/api/tracker` | Get user's tracker entries |
| POST | `/api/tracker` | Add opportunity to tracker |
| PATCH | `/api/tracker/[id]` | Update tracker entry status/notes |
| GET | `/api/notifications` | Get user's notifications |
| PATCH | `/api/notifications/[id]/read` | Mark notification read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/[id]` | Dismiss notification |
| POST | `/api/submissions` | Submit community opportunity (rate-limited) |
| GET | `/api/profile` | Get own profile |
| PATCH | `/api/profile` | Update own profile |
| DELETE | `/api/profile` | Request account deletion (soft delete) |
| POST | `/api/reports` | Report broken link |

#### Moderator+ Routes
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/submissions` | List submission queue |
| PATCH | `/api/admin/submissions/[id]/approve` | Approve submission |
| PATCH | `/api/admin/submissions/[id]/reject` | Reject submission |

#### Admin-Only Routes
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/opportunities` | List all opportunities (all statuses) |
| POST | `/api/admin/opportunities` | Create opportunity |
| PATCH | `/api/admin/opportunities/[id]` | Update opportunity |
| DELETE | `/api/admin/opportunities/[id]` | Delete/archive opportunity |
| GET | `/api/admin/companies` | List companies |
| POST | `/api/admin/companies` | Create company |
| PATCH | `/api/admin/companies/[id]` | Update company |
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/[id]/role` | Change user role |
| PATCH | `/api/admin/users/[id]/suspend` | Suspend user |
| PATCH | `/api/admin/users/[id]/restore` | Restore user |
| GET | `/api/admin/audit-log` | Read audit log |
| GET | `/api/admin/analytics` | Aggregate stats |

### Input Validation Pattern

Every Route Handler that accepts a body or query parameter uses Zod:

```typescript
// Example: community submission validation
const SubmissionSchema = z.object({
  apply_url: z.string().url().max(2048),
  title: z.string().min(5).max(200),
  category: z.enum(['Internship', 'Job', 'Hackathon', 'Workshop', 'Scholarship', 'Competition']),
  deadline: z.string().datetime().nullable(),
  company_name: z.string().min(2).max(100),
  mode: z.enum(['Remote', 'Hybrid', 'Onsite']),
  is_paid: z.boolean(),
  experience_level: z.enum(['Fresher', 'Undergrad', 'Masters', 'Any']),
});
```

---

## 9. Data Schema Design

All tables live in the `public` Supabase schema. All timestamps are `TIMESTAMPTZ` (UTC). UUIDs are generated by `gen_random_uuid()`.

### Table: `profiles`
Extends Supabase Auth's `auth.users`. Created via a trigger on signup.

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  university      TEXT,
  degree          TEXT,
  graduation_year INTEGER,
  skills          TEXT[] DEFAULT '{}',
  interests       TEXT[] DEFAULT '{}',
  resume_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'moderator', 'admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,         -- NULL = active; SET = soft-deleted
  suspended_at    TIMESTAMPTZ          -- NULL = active; SET = suspended
);
```

### Table: `companies`

```sql
CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  website_url  TEXT,
  careers_url  TEXT,
  industry     TEXT,
  logo_url     TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table: `opportunities`

```sql
CREATE TABLE opportunities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL
                   CHECK (category IN ('Internship','Job','Hackathon','Workshop','Scholarship','Competition')),
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  description      TEXT,
  apply_url        TEXT UNIQUE NOT NULL,  -- normalized, unique constraint
  location         TEXT,
  mode             TEXT CHECK (mode IN ('Remote','Hybrid','Onsite')),
  is_paid          BOOLEAN DEFAULT FALSE,
  experience_level TEXT CHECK (experience_level IN ('Fresher','Undergrad','Masters','Any')),
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline         TIMESTAMPTZ,           -- NULL = rolling deadline
  status           TEXT NOT NULL DEFAULT 'Draft'
                   CHECK (status IN ('Draft','Pending Review','Published','Closing Soon','Expired','Rejected','Archived')),
  source_type      TEXT CHECK (source_type IN ('Verified','Community Sourced')),
  submitted_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = Admin entry
  report_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Table: `opportunity_tags`

```sql
CREATE TABLE opportunity_tags (
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  tag_name       TEXT NOT NULL,
  PRIMARY KEY (opportunity_id, tag_name)
);

CREATE INDEX idx_opportunity_tags_name ON opportunity_tags(tag_name);
```

### Table: `bookmarks`

```sql
CREATE TABLE bookmarks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_id)
);
```

### Table: `application_tracker`

```sql
CREATE TABLE application_tracker (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- SET NULL for anonymization
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'Saved'
                 CHECK (status IN ('Saved','Applied','Interview Scheduled','Selected','Rejected')),
  notes          TEXT,
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_id)
);
```

### Table: `notifications`

```sql
CREATE TABLE notifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL
                          CHECK (type IN ('DeadlineAlert','SubmissionApproved','SubmissionRejected','StaleTracker')),
  message                 TEXT NOT NULL,
  is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
  related_opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table: `reports`

```sql
CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  reported_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, reported_by)  -- one report per user per opportunity
);
```

### Table: `audit_log`

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role  TEXT CHECK (actor_role IN ('admin', 'moderator', 'system')),
  action      TEXT NOT NULL,
  target_type TEXT CHECK (target_type IN ('opportunity','user','company','submission','system')),
  target_id   UUID,
  metadata    JSONB,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement via RLS (no UPDATE, no DELETE for any role)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));
-- Inserts only via service role key (server-side, never client-exposed)
```

### Key Database Rule: URL Normalization

Before any `apply_url` is inserted or checked for duplicates, the backend Route Handler normalizes it:

```typescript
function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  // Remove common tracking params
  const STRIP_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','referrer'];
  STRIP_PARAMS.forEach(p => url.searchParams.delete(p));
  // Normalize trailing slash
  return url.toString().replace(/\/$/, '').toLowerCase();
}
```

This normalized URL is what gets stored and checked against the `UNIQUE` constraint.

---

## 10. Security Architecture

### Authentication Security
- Sessions stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies via `@supabase/ssr`
- No session data in `localStorage` (XSS-vulnerable)
- JWT verified server-side on every protected request
- Password reset via Supabase email magic link only

### Input Security
- All user-submitted text fields sanitized using `DOMPurify` (server-side, via `isomorphic-dompurify`) before database insertion
- No raw HTML rendered from user content — all descriptions rendered as plain text or sanitized markdown
- All URL inputs validated with `new URL()` constructor — throws on invalid URLs before they reach the DB
- Zod validation on every Route Handler input — invalid shapes return 400 immediately

### API Security
- All non-public Route Handlers check `supabase.auth.getUser()` first — 401 if no session
- Role check performed after auth check — 403 if insufficient role
- All database writes use parameterized queries via the Supabase SDK (no raw SQL string concatenation)
- Service role key used only in server-side Route Handlers and Edge Functions — never in client bundle

### Content Security Policy (CSP)
Add to `next.config.js` headers:
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://your-supabase-project.supabase.co; connect-src 'self' https://your-supabase-project.supabase.co;
```

### CORS
Next.js Route Handlers do not need explicit CORS configuration for same-origin requests. No external API consumers in MVP, so CORS headers are not added. If in future a mobile app consumes the API, add `Access-Control-Allow-Origin` with a specific origin allowlist.

---

## 11. Rate Limiting and Abuse Prevention

**Challenge:** Vercel Hobby plan does not have built-in rate limiting middleware. External rate limiting services (Upstash Redis) have a free tier but add a dependency.

**Decision for MVP:** Use Supabase database-backed rate limiting for the only high-risk endpoint (community submission). This requires zero additional dependencies.

### Community Submission Rate Limit (5/user/24h)

```sql
-- Check before accepting submission
SELECT COUNT(*) FROM opportunities
WHERE submitted_by = $1
  AND created_at >= NOW() - INTERVAL '24 hours';
-- If count >= 5, return 429
```

This query is fast on an indexed `submitted_by` + `created_at` composite. The check happens inside the Route Handler before any write.

### Report Rate Limit

The `UNIQUE (opportunity_id, reported_by)` constraint on the `reports` table naturally prevents duplicate reports. No additional rate limiting needed.

### Future: Upstash Redis Rate Limiting
When the product has enough traffic to warrant general rate limiting (login brute-force, API flooding):
- Add Upstash Redis (free tier: 10,000 commands/day)
- Use `@upstash/ratelimit` with the `slidingWindow` algorithm
- Apply to: login attempts, signup, submission form, report endpoint
- This is an additive change — no existing code needs to change

---

## 12. Deployment and Hosting

### Frontend: Vercel Hobby (Free)
| Limit | Vercel Hobby |
|---|---|
| Bandwidth | 100 GB/month |
| Serverless Function execution | 100 GB-hours/month |
| Deployments | Unlimited |
| Custom domain | 1 (free) |
| Build minutes | 6,000/month |

**100 GB bandwidth easily supports the MVP.** Risk point: if a specific listing goes viral (campus WhatsApp group share), a single day could consume significant bandwidth. Aggressive Next.js static caching on the Opportunity Hub mitigates this.

### Backend/DB: Supabase Free (Already documented in §5)

### Deployment Flow
```
GitHub push to main
       ↓
Vercel GitHub integration detects push
       ↓
Vercel builds Next.js app
       ↓
Vercel runs migrations? No.
(Supabase migrations run manually or via CI pre-hook)
       ↓
Vercel deploys to Edge network
       ↓
Live in ~60 seconds
```

### Database Migrations
Use **Supabase CLI** for migration management:
```bash
supabase migration new create_opportunities_table
supabase db push   # applies to remote (Supabase cloud)
supabase db reset  # resets local dev database
```

Migrations are version-controlled SQL files in `supabase/migrations/`. This is production-grade and free.

### Local Development
```bash
supabase start     # starts local Postgres + Auth + Storage via Docker
npm run dev        # starts Next.js on localhost:3000
```

Requires Docker Desktop (free) on MacBook M4. The Supabase CLI local stack runs on Apple Silicon natively.

### Custom Domain
Use a free domain from:
- GitHub Student Pack → Namecheap `.me` domain (free for 1 year)
- Or `.vercel.app` subdomain at zero cost

---

## 13. Environment Variables

Never commit secrets to Git. Use `.env.local` for local development. Set the same variables in Vercel project settings for production.

### Required Environment Variables

```bash
# Supabase (public — safe to expose to browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase (private — server-side only, NEVER in NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=https://opportunityradar.vercel.app  # or your custom domain
NODE_ENV=production
```

### Variable Security Rules
- `NEXT_PUBLIC_*` variables are embedded in the client bundle. Safe for Supabase URL and anon key (Supabase is designed for this; RLS is the security layer, not the anon key).
- `SUPABASE_SERVICE_ROLE_KEY` must **never** appear in any client component or `NEXT_PUBLIC_` variable. It bypasses RLS entirely and would be a critical security breach if exposed.
- All secrets are set as **environment variables in Vercel project settings** (not in the repo).

### `.gitignore` Additions
```
.env.local
.env.development.local
.env.production.local
```

---

## 14. Folder Structure

```
opportunity-radar/
├── .env.local                      ← Local dev secrets (gitignored)
├── next.config.ts                  ← Next.js configuration
├── tailwind.config.ts              ← Tailwind configuration
├── tsconfig.json
├── package.json
│
├── supabase/
│   ├── migrations/                 ← SQL migration files (version-controlled)
│   │   ├── 001_create_profiles.sql
│   │   ├── 002_create_companies.sql
│   │   ├── 003_create_opportunities.sql
│   │   ├── 004_create_tags.sql
│   │   ├── 005_create_bookmarks.sql
│   │   ├── 006_create_tracker.sql
│   │   ├── 007_create_notifications.sql
│   │   ├── 008_create_reports.sql
│   │   ├── 009_create_audit_log.sql
│   │   ├── 010_create_indexes.sql
│   │   └── 011_create_rls_policies.sql
│   ├── functions/                  ← Edge Functions (cron jobs)
│   │   ├── expire-opportunities/
│   │   ├── flag-closing-soon/
│   │   ├── stale-tracker-reminder/
│   │   ├── escalate-stale-submissions/
│   │   └── purge-deleted-accounts/
│   └── config.toml
│
├── src/
│   ├── app/                        ← Next.js App Router
│   │   ├── (public)/
│   │   │   ├── page.tsx            ← Opportunity Hub (Server Component)
│   │   │   ├── opportunities/
│   │   │   │   └── [id]/page.tsx   ← Opportunity detail
│   │   │   └── companies/
│   │   │       └── [id]/page.tsx   ← Company profile
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (protected)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tracker/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── submit/page.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── layout.tsx      ← Admin shell (role guard)
│   │   │       ├── page.tsx        ← Admin overview
│   │   │       ├── opportunities/
│   │   │       ├── submissions/
│   │   │       ├── companies/
│   │   │       ├── users/
│   │   │       └── audit-log/
│   │   ├── api/                    ← Route Handlers
│   │   │   ├── opportunities/
│   │   │   ├── bookmarks/
│   │   │   ├── tracker/
│   │   │   ├── notifications/
│   │   │   ├── submissions/
│   │   │   ├── reports/
│   │   │   ├── profile/
│   │   │   └── admin/
│   │   ├── layout.tsx              ← Root layout
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui components (copied in)
│   │   ├── opportunity/
│   │   │   ├── OpportunityCard.tsx
│   │   │   ├── OpportunityGrid.tsx
│   │   │   ├── OpportunityDetail.tsx
│   │   │   ├── DeadlineBadge.tsx
│   │   │   ├── FreshFeedFilter.tsx
│   │   │   └── CategoryBadge.tsx
│   │   ├── tracker/
│   │   │   ├── TrackerBoard.tsx
│   │   │   └── TrackerCard.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationBell.tsx
│   │   │   └── NotificationPanel.tsx
│   │   ├── admin/
│   │   │   ├── SubmissionQueue.tsx
│   │   │   ├── OpportunityForm.tsx
│   │   │   └── AuditLogTable.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── SearchBar.tsx
│   │       ├── FilterPanel.tsx
│   │       ├── EmptyState.tsx      ← Reusable empty state component
│   │       └── LoadingSpinner.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           ← Browser Supabase client
│   │   │   ├── server.ts           ← Server Supabase client (cookies)
│   │   │   └── admin.ts            ← Service role client (server-only)
│   │   ├── validations/
│   │   │   ├── opportunity.ts      ← Zod schemas
│   │   │   ├── submission.ts
│   │   │   └── profile.ts
│   │   ├── utils/
│   │   │   ├── url.ts              ← URL normalization
│   │   │   ├── time.ts             ← Countdown, UTC formatting helpers
│   │   │   ├── sanitize.ts         ← DOMPurify wrapper
│   │   │   └── audit.ts            ← writeAuditLog() helper
│   │   └── constants.ts            ← Enums, allowlists, config
│   │
│   ├── hooks/
│   │   ├── useNotifications.ts
│   │   ├── useBookmark.ts
│   │   └── useTracker.ts
│   │
│   ├── types/
│   │   ├── database.ts             ← Supabase generated types
│   │   └── app.ts                  ← App-specific type aliases
│   │
│   └── middleware.ts               ← Auth guard + role enforcement
│
└── docs/
    ├── PRD.md
    ├── TRD.md
    ├── App-Flow.md
    ├── Backend-Schema.md
    ├── UI-UX-Brief.md
    └── Implementation-Plan.md
```

---

## 15. Performance Strategy

### Next.js Caching Strategy

| Route | Caching Strategy | Rationale |
|---|---|---|
| `/` (Opportunity Hub) | ISR — `revalidate: 300` (5 min) | Public, high-traffic; 5min matches Fresh Feed SLA |
| `/opportunities/[id]` | ISR — `revalidate: 600` (10 min) | Individual listings change rarely |
| `/companies/[id]` | ISR — `revalidate: 3600` (1 hour) | Company profiles rarely change |
| `/api/opportunities` (GET) | `Cache-Control: s-maxage=60` | Shared cache for filtered queries |
| All protected routes | No cache (`private, no-store`) | User-specific data |
| All admin routes | No cache | Real-time operational data |

### Image Optimization
- Company logos stored in Supabase Storage and served via its CDN URL
- Next.js `<Image>` component with `width`, `height`, and `priority` on above-the-fold logos
- Logos must be under 100KB; enforce on upload in admin panel

### Database Query Optimization
- All list queries use `LIMIT` + `OFFSET` pagination. Default page size: 20.
- Never use `SELECT *` — always specify columns in production queries
- The public Opportunity Hub fetches only: `id, title, category, mode, is_paid, deadline, status, posted_at, company_id` — not the full description — on the listing page. Description is fetched only on the detail page.

### Countdown Timers
- Timer values (seconds remaining to deadline) are calculated server-side in the Route Handler
- Client renders the countdown via `setInterval` ticking down from the initial server value
- Timer is not re-fetched from server on every tick — only on page load/navigation. Acceptable for MVP.

---

## 16. Backup, Recovery, and Observability

### Database Backup
Supabase Free tier includes **daily automated backups with 7-day retention**. This is sufficient for MVP. No manual backup strategy required.

### Disaster Recovery Plan
| Scenario | Recovery Path |
|---|---|
| Database corruption | Restore from Supabase daily backup via the dashboard |
| Accidental data deletion | Admin manually restores via SQL in Supabase Studio |
| Vercel deployment failure | Revert to previous deployment in Vercel dashboard (one click) |
| Secret key leaked | Rotate in Supabase dashboard; update in Vercel env vars; redeploy |

### Observability (Free Tier)
| Tool | Purpose | Free Tier |
|---|---|---|
| Vercel Analytics | Web vitals, page performance | Included with Hobby |
| Supabase Dashboard | DB query performance, auth events | Included |
| Next.js console.error | Server-side error logging | Built-in |
| Vercel Function Logs | Route Handler error logs | 1-hour rolling window on Hobby |

**Gap:** Vercel Hobby only retains logs for 1 hour. For persistent error tracking:
- Add **Sentry** (free tier: 5,000 errors/month). Initialize in `instrumentation.ts`. This is strongly recommended even in MVP — it takes 10 minutes to set up and has saved countless production bugs.

### Monitoring Alerts
- **Supabase:** Set up email alerts for database storage > 400MB (80% of 500MB free limit)
- **Vercel:** No built-in alerting on Hobby. Sentry covers application-level errors.

---

## 17. Error Handling

### Route Handler Error Pattern

Every Route Handler wraps its logic in a try/catch:

```typescript
export async function POST(request: Request) {
  try {
    const session = await getServerSession(); // throws if no session
    const body = await request.json();
    const validated = SubmissionSchema.parse(body); // throws ZodError if invalid
    // ... business logic
    return Response.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ data: null, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    if (error instanceof AuthError) {
      return Response.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 });
    }
    // Log unexpected errors to Sentry
    console.error('[API Error]', error);
    return Response.json({ data: null, error: { code: 'SERVER_ERROR', message: 'Something went wrong' } }, { status: 500 });
  }
}
```

### Frontend Error Handling

| Scenario | UI Behavior |
|---|---|
| Network request fails | Show inline error message; do not crash the page |
| Empty search results | Show `<EmptyState>` component with suggested action |
| Empty tracker/dashboard | Show onboarding empty state: "Browse opportunities to get started" |
| Expired opportunity in tracker | Show greyed card: "This opportunity has closed" with notes still visible |
| 401 on protected route | Middleware redirects to `/login?next=/original-path` |
| Rate limit (429) | Show: "You've reached the daily submission limit. Try again tomorrow." |
| Duplicate URL submission | Show inline: "This opportunity is already on Opportunity Radar." |

### Cron Job Failure Handling

Each Edge Function cron job catches its own errors and:
1. Logs the failure using `console.error` (visible in Supabase Edge Function logs)
2. Writes a `SYSTEM_ERROR` entry to the `audit_log` with `target_type = 'system'` and error details in `metadata`
3. The Admin dashboard queries the audit log for system error entries and displays a banner if any exist within the last 24 hours

---

## 18. Implementation Phases

### Phase 0: Foundation (Week 1)
**Goal:** Working codebase, database, and auth before any features.

- [ ] Initialize Next.js 14 project with TypeScript + Tailwind + shadcn/ui
- [ ] Set up Supabase project (cloud) and local development environment
- [ ] Write and apply all migration files (001 through 011)
- [ ] Set up Supabase Auth with email/password + Google OAuth
- [ ] Implement `middleware.ts` for auth guards
- [ ] Configure all environment variables (local + Vercel)
- [ ] Deploy skeleton app to Vercel — confirm deployment pipeline works
- [ ] **[SPIKE]** Determine Resume Toolkit integration feasibility — link or embed

---

### Phase 1: Public Opportunity Hub (Week 2)
**Goal:** Strangers can browse and search opportunities. Looks production-quality.

- [ ] Create `opportunities` table, `companies` table, `opportunity_tags` table
- [ ] Apply all indexes from §5
- [ ] Seed database with 50 real opportunities for development/testing
- [ ] Build `GET /api/opportunities` with filtering and pagination
- [ ] Build Opportunity Hub page (Server Component, ISR)
- [ ] Build OpportunityCard component with DeadlineBadge and CategoryBadge
- [ ] Build FilterPanel (category, mode, paid/free, experience level) — Client Component
- [ ] Build SearchBar with full-text search — Client Component
- [ ] Build Fresh Feed section with time-box selector
- [ ] Build Opportunity Detail page (`/opportunities/[id]`)
- [ ] Build Company Profile page (`/companies/[id]`)
- [ ] Implement timezone-safe deadline display and countdown

---

### Phase 2: Auth + Student Dashboard (Week 3)
**Goal:** Students can sign up, log in, and see their personal dashboard.

- [ ] Build login and signup pages using Supabase Auth UI or custom forms
- [ ] Create profile trigger: auto-create `profiles` row on auth.users insert
- [ ] Build profile edit page
- [ ] Create `bookmarks` table + RLS policies
- [ ] Build Bookmark button with optimistic UI toggle
- [ ] Create `application_tracker` table + RLS policies
- [ ] Build Application Tracker page (list view first; Kanban optional polish)
- [ ] Build Student Dashboard (saved, upcoming deadlines, recent tracker updates)
- [ ] Implement Resume Toolkit integration (link-out or embed based on Phase 0 spike result)

---

### Phase 3: Notifications + Community Submissions (Week 4)
**Goal:** The engagement loop is complete — students can submit and get notified.

- [ ] Create `notifications` table + RLS policies
- [ ] Build NotificationBell + NotificationPanel client components
- [ ] Build `GET/PATCH /api/notifications` routes
- [ ] Build Community Submission form + `POST /api/submissions` with rate limiting
- [ ] Create `reports` table
- [ ] Build "Report broken link" button + `POST /api/reports`
- [ ] Auto-hide logic: increment `report_count`; revert to `Pending Review` at 3 reports
- [ ] Set up all 5 Supabase Edge Function cron jobs
- [ ] Test all cron job logic with manual triggers

---

### Phase 4: Admin Dashboard (Week 5)
**Goal:** Admins and Moderators can manage the full platform.

- [ ] Build Admin layout with role guard
- [ ] Build Submission Queue page (list + approve/reject actions)
- [ ] Build Opportunity CRUD interface (Admin only)
- [ ] Build Company management interface (Admin only)
- [ ] Build User management interface (Admin only — role change, suspend)
- [ ] Create `audit_log` table + RLS + `writeAuditLog()` helper
- [ ] Wire `writeAuditLog()` into all admin/moderator mutations
- [ ] Build Audit Log viewer (date-filtered table, Admin only)
- [ ] Build Analytics overview (aggregate stats, no PII)
- [ ] Implement Admin cron failure banner

---

### Phase 5: Polish and Pre-Launch (Week 6)
**Goal:** Production-ready. No obvious bugs. Looks excellent.

- [ ] Add Terms of Service and Privacy Policy pages
- [ ] Implement all empty states for Dashboard, Tracker, Search, Notifications
- [ ] First-time user onboarding state on Dashboard
- [ ] Mobile responsiveness audit (test on 375px, 390px, 414px widths)
- [ ] Add Sentry error tracking
- [ ] Set up Supabase storage alert (email at 80% capacity)
- [ ] Content Security Policy headers in `next.config.ts`
- [ ] Final URL normalization + duplicate detection end-to-end test
- [ ] Load test: seed 500 opportunities and verify filter/search performance
- [ ] Set up custom domain on Vercel
- [ ] Deploy to production and run full smoke test

---

## 19. Risks and Tradeoffs

### Risk 1: Supabase Free Tier Bandwidth (5 GB/month)
- **Likelihood:** Low for first 3 months; Medium after campus launch
- **Impact:** Site becomes slow or returns errors after quota exhaustion
- **Mitigation:** ISR caching reduces bandwidth heavily. Monitor in Supabase dashboard.
- **Fallback:** Upgrade to Supabase Pro ($25/month) when bandwidth consistently exceeds 4 GB/month. The architecture requires zero changes.

### Risk 2: Vercel Serverless Function Cold Starts
- **Likelihood:** Medium (Hobby plan does not keep functions warm)
- **Impact:** First request after idle period takes 1–3 seconds
- **Mitigation:** Public pages are statically rendered (ISR). Cold starts only affect API routes, which are triggered by user actions (not initial page load).
- **Fallback:** Acceptable for MVP. Upgrade to Vercel Pro ($20/month) for always-warm functions when needed.

### Risk 3: Supabase Edge Function Cron Reliability
- **Likelihood:** Low
- **Impact:** Opportunities may not expire or trigger notifications on exact schedule
- **Mitigation:** Build idempotent cron functions (running twice is harmless). Add `audit_log` failure entries that surface in the Admin dashboard. Check manually if no new log entries appear in 24 hours.
- **Fallback:** Trigger cron jobs manually via Supabase Dashboard if automation fails.

### Risk 4: Resume Toolkit Integration Failure
- **Likelihood:** Medium (architecture is unvalidated)
- **Impact:** The "integrated resume toolkit" differentiator becomes a simple link
- **Mitigation:** Decision made in Phase 0 spike. A styled "Open Resume Toolkit" button is still valuable — it is better than a broken embed.
- **Fallback:** External link with no code dependency.

### Risk 5: PostgreSQL Full-Text Search Performance Degradation
- **Likelihood:** Low for < 50,000 opportunities
- **Impact:** Search latency increases beyond 500ms
- **Mitigation:** GIN index on the `tsvector` column is in the migration files. Queries use indexed columns for filtering before text search.
- **Fallback:** Add Typesense Cloud (free tier) as a search layer — additive upgrade, no schema changes.

### Key Tradeoff: No Realtime Notifications
The in-app notification bell does NOT use Supabase Realtime subscriptions in MVP. Instead, the notification count is fetched on:
- Every page navigation (Server Component re-render)
- After every bookmark, tracker update, or submission action (SWR revalidation)

**Why:** Supabase Realtime on the free tier is limited to 200 concurrent connections. If 200 students are simultaneously online, new connections are rejected. For an MVP targeting 500–2,000 users, this is not safe.

**Tradeoff:** The notification badge count may be 30–60 seconds stale between user interactions. This is acceptable for in-app notifications (not time-critical alerts).

**Future:** Add Supabase Realtime when on a paid plan (500 concurrent connections on Pro).

---

## 20. Future Upgrade Path

| Current (MVP) | Future Upgrade | Trigger |
|---|---|---|
| Supabase Free | Supabase Pro ($25/mo) | > 400 MB DB or > 4 GB bandwidth/month |
| Vercel Hobby | Vercel Pro ($20/mo) | Cold start complaints or > 90 GB bandwidth |
| PostgreSQL FTS | Typesense Cloud (free tier → paid) | Search latency > 500ms; > 50k opportunities |
| In-app notifications only | Email notifications via Resend (free: 3,000/mo) | Post-MVP v2 |
| Manual curation | Structured web scraping (Puppeteer + cron) | > 5 admins or > 100 submissions/day needed |
| Route Handlers only | Separate API service (Express/Hono) | Multi-client (mobile app) or team scaling |
| No rate limiting service | Upstash Redis rate limiting | Login brute-force attempts or spam |
| Sentry free | Sentry Team ($26/mo) | > 5,000 errors/month |

**The architecture is designed so every upgrade is additive or a direct service swap. No rewrites.**

---

## 21. Final Recommended Stack

| Layer | Technology | Reason |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Best full-stack TypeScript framework; Server Components reduce client JS; Vercel native |
| **Language** | TypeScript (strict) | Type safety across frontend + backend in one codebase |
| **UI** | Tailwind CSS + shadcn/ui | Fast styling with full design control; no CSS library lock-in |
| **Database** | Supabase PostgreSQL | Relational data model; RLS; full-text search; free managed hosting |
| **Auth** | Supabase Auth | Free; integrated with DB; handles OAuth, magic links, sessions |
| **Backend API** | Next.js Route Handlers | Zero additional server; same deployment as frontend |
| **Cron Jobs** | Supabase Edge Functions | Free; Deno-based; cron scheduling built-in |
| **Storage** | Supabase Storage | Company logos only; CDN-served; free 1GB |
| **Search** | PostgreSQL FTS + GIN index | Zero additional cost; sufficient to 50k records |
| **Hosting (Frontend)** | Vercel Hobby | Free; GitHub-integrated; automatic HTTPS; 100 GB bandwidth |
| **Error Tracking** | Sentry (free tier) | 10 minutes to set up; critical for production quality |
| **State Management** | Zustand (minimal) | Lightweight; only for notification count + auth user |
| **Forms** | React Hook Form + Zod | Type-safe validation shared between server and client |
| **Local Dev** | Supabase CLI + Docker | Full local stack; matches production exactly |

---

## 22. Ready-for-Build Checklist

Before writing the first line of application code, confirm all of the following:

### Environment
- [ ] Supabase project created (cloud)
- [ ] Supabase CLI installed and authenticated (`supabase login`)
- [ ] Docker Desktop installed and running (for local Supabase stack)
- [ ] Node.js 20+ installed (`node -v`)
- [ ] Git repository initialized and connected to GitHub
- [ ] Vercel account connected to GitHub repository
- [ ] All environment variables set in both `.env.local` and Vercel project settings

### Architecture Decisions Confirmed
- [ ] Resume Toolkit spike completed — integration approach decided (embed or link)
- [ ] Domain name decided and configured in Vercel
- [ ] Sentry project created and DSN noted

### Database
- [ ] All 11 migration files written and reviewed
- [ ] All RLS policies written and reviewed
- [ ] All indexes confirmed in migration 010
- [ ] Seed file prepared with 50 sample opportunities for development

### Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed as server-only — not in any `NEXT_PUBLIC_` variable
- [ ] CSP headers added to `next.config.ts`
- [ ] `DOMPurify` / `isomorphic-dompurify` added to dependencies

### Code Quality
- [ ] ESLint configured with TypeScript rules
- [ ] Prettier configured
- [ ] Supabase type generation command added to `package.json` scripts: `"db:types": "supabase gen types typescript --linked > src/types/database.ts"`

### Deployment
- [ ] First deployment to Vercel succeeded with skeleton app
- [ ] Database migrations successfully applied to remote Supabase instance
- [ ] Environment variables verified working in production

---

*TRD complete. The next document to produce is the App Flow Document, followed by the UI/UX Brief.*
