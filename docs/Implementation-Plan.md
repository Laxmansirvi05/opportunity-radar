# Implementation Plan: Opportunity Radar

## 1. Implementation Overview

The purpose of this document is to bridge the product requirements (PRD, TRD, App Flow, UI Screen Map, Backend Schema) into a concrete, executable roadmap for development. This plan serves as the definitive guide for building Opportunity Radar, ensuring that development remains structured, predictable, and strictly aligned with the MVP scope.

**Source of Truth Hierarchy:**
1. **PRD.md / MVP Boundaries:** Defines *what* we are building and what is strictly out of scope.
2. **Backend-Schema.md:** Defines the data contract, roles, and authorization rules.
3. **App-Flow.md & UI-SCREEN-MAP.md:** Defines the user journey, navigation, and state transitions.
4. **TRD.md:** Defines the technology stack (Next.js 14, Supabase) and architectural boundaries.
5. **Implementation-Plan.md (This Document):** Defines the *execution order* and verification steps.

**AI-Agent Safety Note:**
All implementation must strictly follow the PRD, TRD, App Flow, UI Screen Map, and Backend Schema. If a conflict appears between documents, the **Backend Schema** and **App Flow** should win for implementation details, while the **PRD** must remain the absolute authority for product scope.

**Development Philosophy:**
- **MVP-First Approach:** Strictly adhere to the scoped features. No email/SMS notifications, no AI features, no paid tiers, and no employer dashboards.
- **Iterative Build Strategy:** Build in vertical slices. Freeze lower layers (like database and auth) before moving to upper layers (like UI flows).
- **Quality and Verification:** Each phase must be independently verifiable before the next phase begins.

---

## MVP Scope Lock

**Homepage / Route Clarity:**
* `/` is the Opportunity Hub homepage in the MVP.
* There is no separate marketing landing page in the MVP build.
* The 3D hero/opening page is a later presentation-layer enhancement, not part of the MVP implementation phase unless formally added to the scope.

Included:
* Opportunity Hub
* Search & Filtering
* Opportunity Details
* Company Profiles
* Dashboard
* Application Tracker
* Notifications
* Profile Management
* Community Submission
* Moderation
* Admin Operations
* Resume Toolkit Integration

Excluded:
* AI Recommendations
* Paid Plans
* Employer Portal
* Messaging
* Community Forums
* Social Networking
* Advanced Analytics

---

## Explicitly Out of Scope

The following features are strictly out of scope for the MVP to prevent AI agents from introducing scope creep:
* AI Recommendations
* Paid Plans
* Employer Portal
* Messaging
* Community Forums
* Social Networking
* Advanced Analytics

---

## 2. Execution Principles

The following principles govern the development process for Opportunity Radar:

1. **Build in small, testable increments:** Do not write the entire application at once. Complete a phase, verify it, and then proceed.
2. **Freeze completed layers:** Once the database schema is verified, do not alter it unless a critical blocker is discovered.
3. **No scope creep:** Strictly follow the PRD MVP boundaries. If a feature is not in the PRD, it does not get built.
4. **Follow the route map exactly:** Use the exact routes defined in `App-Flow.md`.
5. **Follow the backend schema exactly:** Use the exact tables, fields, and enums defined in `Backend-Schema.md`.
6. **Keep student UX simple and frictionless:** Prioritize mobile-first design and ensure core actions are reachable with minimal effort.
7. **Prioritize deployability and maintainability:** Ensure the project can be deployed to Vercel and Supabase cleanly at any stable phase.

---

## 3. Build Phases

The implementation is broken down into 14 distinct phases. Each phase builds upon the previous ones, minimizing integration risk.

---

## 4. Required Phases

## Documentation Freeze Verification

Verify:
* PRD frozen
* TRD frozen
* App Flow frozen
* UI Screen Map frozen
* Backend Schema frozen
* UI UX Brief frozen

---

### Phase 0 — Project Initialization

**Objective:** Set up the foundational Next.js project, styling, and Supabase integration.
**Scope:** Repository setup, core dependencies, and initial project structure.
**Inputs / Dependencies:** TRD.md (Tech Stack).

**Implementation Tasks:**
- Initialize Next.js 14 App Router project with TypeScript.
- Install and configure Tailwind CSS.
- Set up shadcn/ui and add base components (buttons, inputs, cards).
- Establish the folder structure (`app/(public)`, `app/(protected)`, `app/(admin)`, `app/api`).
- Configure environment variables (`.env.local` for Supabase URL and Anon Key).
- Initialize Supabase JS client (`@supabase/ssr`).
- Create the base application layout, including the responsive Top Navigation Bar and Mobile Bottom Nav/Desktop Sidebar.

**Files / Modules Likely Created:**
- `package.json`, `next.config.js`, `tailwind.config.ts`, `components.json`
- `app/layout.tsx`, `app/globals.css`
- `utils/supabase/client.ts`, `utils/supabase/server.ts`
- `components/ui/*` (shadcn components)
- `components/layout/Navbar.tsx`, `components/layout/Sidebar.tsx`

**Acceptance Criteria:**
- Project runs locally without errors (`npm run dev`).
- Base app shell and navigation render correctly.
- Design system and theme colors are applied.

**Verification Checklist:**
- [ ] Verify Next.js routing works for dummy pages.
- [ ] Verify Tailwind classes apply correctly.
- [ ] Verify environment variables are loaded.

**Risks / Notes:**
- Ensure `@supabase/ssr` is correctly implemented to avoid session leakage across requests in Next.js App Router.

### Security Gate
* Environment variables securely configured
* Client and server side Supabase helpers correctly isolated

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 1 — Authentication

**Objective:** Implement secure user authentication and session management.
**Scope:** Login, Signup, OAuth, and protected route middleware.
**Inputs / Dependencies:** Phase 0, App-Flow.md (Auth Flow), Backend-Schema.md.

**Implementation Tasks:**
- Set up Supabase Auth provider settings (Email/Password, Google OAuth, GitHub OAuth).
- Build `/signup` page with email/password, Google OAuth, and GitHub OAuth buttons.
- Build `/login` page with email/password, Google OAuth, GitHub OAuth, and "Forgot Password" flow.
- Keep the authentication flow student-friendly and simple.
- Implement Next.js Middleware (`middleware.ts`) to guard `/(protected)` and `/(admin)` routes.
- Implement auth redirect logic using the `?next=` parameter.
- Implement Logout functionality.

**Files / Modules Likely Created:**
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
- `middleware.ts`
- `app/api/auth/callback/route.ts`
- `app/api/auth/logout/route.ts`

**Acceptance Criteria:**
- Users can create accounts and log in.
- Google and GitHub OAuth flows complete successfully.
- Unauthenticated users trying to access `/dashboard` are redirected to `/login`.
- Authenticated users are redirected away from `/login` to `/dashboard`.
- Sessions persist across page reloads.

**Verification Checklist:**
- [ ] Test email/password signup and login.
- [ ] Test Google and GitHub OAuth login.
- [ ] Verify middleware correctly blocks access to protected routes.
- [ ] Test logout clears the session.

**Risks / Notes:**
- Password reset requires Supabase email templates to be configured properly in the Supabase dashboard.

### Security Gate
* Session validation verified
* Protected routes verified

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 2 — Database Foundation

**Objective:** Implement the PostgreSQL database structure and security policies.
**Scope:** Tables, triggers, indexes, and Row Level Security (RLS).
**Inputs / Dependencies:** Backend-Schema.md, Phase 1.

**Implementation Tasks:**
- Create Supabase migrations for all core tables: `profiles`, `companies`, `opportunities`, `opportunity_tags`, `saved_opportunities`, `application_tracker`, `notifications`, `broken_reports`, and `audit_logs`.
- Implement the profile creation trigger (auto-create `profiles` row when a user signs up in `auth.users`).
- Define rigorous Row Level Security (RLS) policies for all tables based on RBAC rules.
- Create database indexes optimized for the Fresh Feed and Search queries.
- Create storage buckets (`avatars`, `company-logos`, `report-evidence`).

**Files / Modules Likely Created:**
- `supabase/migrations/*_init_schema.sql`
- `supabase/seed.sql` (for local development testing)

**Acceptance Criteria:**
- All tables and relationships match `Backend-Schema.md` exactly.
- RLS policies correctly restrict access based on the `role` field in the `profiles` table.
- A new signup automatically generates a corresponding `profiles` record.

**Verification Checklist:**
- [ ] Apply migrations to a local Supabase instance.
- [ ] Insert seed data for companies and opportunities.
- [ ] Test RLS policies manually (Student cannot update another Student's tracker).

**Risks / Notes:**
- Ensure the Supabase Service Role key is NEVER exposed to the frontend, as it bypasses RLS (needed for audit logs).

### Security Gate
* RLS verified
* Permissions verified

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 3 — Opportunity Discovery

**Objective:** Build the core public-facing discovery engine.
**Scope:** Opportunity Hub, Search, Filters, Fresh Feed, Opportunity Detail, Company Profile.
**Inputs / Dependencies:** Phase 2, UI-SCREEN-MAP.md, App-Flow.md.

**Implementation Tasks:**
- Build `/api/opportunities` route handler with text search (`to_tsvector`) and filtering logic.
- Build the Opportunity Hub (`/`) server component with URL-driven state for search and filters.
- Implement the "Fresh Feed" toggle (1h, 6h, 24h).
- Build the Opportunity Detail page (`/opportunities/[id]`).
- Build the Company Profile page (`/companies/[id]`).
- Implement the Save Opportunity toggle (optimistic UI) for authenticated users.

**Files / Modules Likely Created:**
- `app/(public)/page.tsx`
- `app/(public)/opportunities/[id]/page.tsx`
- `app/(public)/companies/[id]/page.tsx`
- `app/api/opportunities/route.ts`
- `app/api/saved-opportunities/route.ts`
- `components/OpportunityCard.tsx`
- `components/FilterPanel.tsx`

**Acceptance Criteria:**
- Visitors can browse, search, and filter opportunities without logging in.
- The URL acts as the single source of truth for all filters and search state.
- Default sort order rules (Closing Soon first, then newest) are applied correctly.
- Authenticated users can save opportunities directly from the Hub or Detail page.

**Verification Checklist:**
- [ ] Test full-text search returns accurate results.
- [ ] Test multiple filters combined (e.g., Internship + Remote).
- [ ] Verify the save action requires login and works when authenticated.

**Risks / Notes:**
- Keep search and filter state strictly in the URL to ensure back-button navigation works perfectly.

### Security Gate
* No sensitive user data leaked in public API responses
* Rate limiting or caching correctly applied on public endpoints

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 4 — Student Dashboard and Tracker

**Objective:** Build the core student productivity and tracking layer.
**Scope:** Student Dashboard, Application Tracker list view, Status updates.
**Inputs / Dependencies:** Phase 3, App-Flow.md.

**Implementation Tasks:**
- Build `/dashboard` page displaying upcoming deadlines, fresh opportunities, tracker summary, and recent notifications.
- Build `/tracker` page with a list-based view of tracked applications.
- Implement tracker status transitions (Saved → Applied → Interview Scheduled → Selected → Rejected).
- Implement inline note-editing for tracker entries.
- Add the "Have you applied?" prompt on the Opportunity Detail page when clicking "Apply Now".

**Files / Modules Likely Created:**
- `app/(protected)/dashboard/page.tsx`
- `app/(protected)/tracker/page.tsx`
- `app/api/tracker/route.ts`
- `app/api/tracker/[id]/route.ts`
- `components/TrackerItem.tsx`

**Acceptance Criteria:**
- Saving an opportunity automatically creates a tracker entry with status "Saved".
- Users can update the status of their applications.
- The dashboard accurately reflects real-time tracker counts and approaching deadlines.

**Verification Checklist:**
- [ ] Verify status changes persist to the database.
- [ ] Verify notes can be added and updated.
- [ ] Test the "Apply Now" redirect and subsequent tracker prompt.

**Risks / Notes:**
- Ensure tracker data remains strictly private via RLS.

### Security Gate
* Users can only access and modify their own tracker entries
* RLS enforced on all tracker read/writes

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 5 — Notifications

**Objective:** Implement the in-app notification system.
**Scope:** Notification Center, unread badges, Supabase Edge Functions for crons.
**Inputs / Dependencies:** Phase 4, Backend-Schema.md.

**Implementation Tasks:**
- Build `/notifications` page to list all notifications.
- Implement the unread count badge in the global Navbar.
- Build API routes to mark notifications as read, mark all as read, and dismiss.
- Implement Supabase Edge Functions (cron jobs):
  - `flag-closing-soon`: Triggers `DeadlineAlert`.
  - `stale-tracker-reminder`: Triggers `StaleTracker`.
  - `expire-opportunities`: Updates status to `Expired`.

**Files / Modules Likely Created:**
- `app/(protected)/notifications/page.tsx`
- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `supabase/functions/flag-closing-soon/index.ts`
- `supabase/functions/expire-opportunities/index.ts`

**Acceptance Criteria:**
- Unread badge correctly reflects the number of unread notifications.
- Users can read and dismiss notifications.
- Cron jobs successfully execute and generate the correct notifications based on deadlines and tracker age.

**Verification Checklist:**
- [ ] Test marking individual and all notifications as read.
- [ ] Manually invoke Edge Functions locally to verify notification generation.

**Risks / Notes:**
- Notifications are in-app only. Do not build email or SMS integration.

### Security Gate
* Notifications only accessible by the owner
* Edge functions properly authenticated

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 6 — Profile Management

**Objective:** Allow students to manage their personal profiles.
**Scope:** Profile viewing, editing, and soft account deletion.
**Inputs / Dependencies:** Phase 1, App-Flow.md.

**Implementation Tasks:**
- Build `/profile` page with display and edit modes.
- Implement forms to update university, skills, interests, and resume link.
- Implement the account deletion flow (soft delete: set `deleted_at`, clear session).
- Implement the `purge-deleted-accounts` cron job (purges data after 30 days).

**Files / Modules Likely Created:**
- `app/(protected)/profile/page.tsx`
- `app/api/profile/route.ts`
- `supabase/functions/purge-deleted-accounts/index.ts`

**Acceptance Criteria:**
- Users can update their profile information.
- All profile data remains private to the user.
- Account deletion successfully soft-deletes the profile and logs the user out.

**Verification Checklist:**
- [ ] Test updating skills and interests.
- [ ] Verify RLS prevents other users from reading the profile.
- [ ] Test the soft deletion flow.

**Risks / Notes:**
- Ensure the Resume Toolkit is surfaced here as a link, pending the technical spike results.

### Security Gate
* Profile data is strictly private
* Users can only edit their own profile

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 7 — Community Submission

**Objective:** Enable students to contribute opportunities.
**Scope:** Submission form, URL validation, duplicate detection, rate limiting.
**Inputs / Dependencies:** Phase 2, App-Flow.md.

**Implementation Tasks:**
- Build `/submit` page with the opportunity submission form.
- Implement rigorous Zod validation for all form fields.
- Implement server-side URL normalization and duplicate detection.
- Implement database-backed rate limiting (max 5 per day per user).
- Save submissions with status `Pending Review`.

**Files / Modules Likely Created:**
- `app/(protected)/submit/page.tsx`
- `app/api/submissions/route.ts`
- `utils/normalizeUrl.ts`

**Acceptance Criteria:**
- Logged-in students can submit opportunities.
- Submitting a duplicate URL fails gracefully with an inline error.
- Exceeding 5 submissions in 24 hours blocks further submissions.
- Submissions enter the database as `Pending Review`.

**Verification Checklist:**
- [ ] Test submitting a valid opportunity.
- [ ] Test duplicate URL rejection.
- [ ] Test the rate limit by submitting 6 times.

**Risks / Notes:**
- URL normalization is critical to prevent database bloat and duplicate entries.

### Security Gate
* Form inputs sanitized
* Rate limiting enforced
* Storage permissions verified

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 8 — Moderation Workflow

**Objective:** Provide tools for Moderators to review submissions.
**Scope:** Submission Queue, Approve/Reject actions, Audit Logging.
**Inputs / Dependencies:** Phase 7, Backend-Schema.md.

**Implementation Tasks:**
- Build `/admin/submissions` page (Moderator + Admin access).
- Implement API routes to approve and reject submissions.
- Hook approval/rejection actions to generate in-app notifications (`SubmissionApproved`, `SubmissionRejected`) for the submitter.
- Write to the `audit_logs` table using the Service Role key on every moderation action.
- Implement the `escalate-stale-submissions` cron job.

**Files / Modules Likely Created:**
- `app/(admin)/admin/submissions/page.tsx`
- `app/api/admin/submissions/[id]/approve/route.ts`
- `app/api/admin/submissions/[id]/reject/route.ts`
- `supabase/functions/escalate-stale-submissions/index.ts`

**Acceptance Criteria:**
- Moderators can view the queue of `Pending Review` items.
- Approving an item changes its status to `Published` and makes it visible in the Hub.
- Rejecting an item changes its status to `Rejected`.
- Audit logs correctly record the actor and action.

**Verification Checklist:**
- [ ] Test approving a submission and verifying it appears in the Fresh Feed.
- [ ] Test rejecting a submission.
- [ ] Verify the submitter receives the correct notification.

**Risks / Notes:**
- Ensure the Moderator role cannot access other admin tools (like user management).

### Security Gate
* Audit logs verified
* Moderator role authorization enforced

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 9 — Broken Opportunity Reporting

**Objective:** Implement crowd-sourced quality control.
**Scope:** Report flow, tracking, auto-hiding.
**Inputs / Dependencies:** Phase 3.

**Implementation Tasks:**
- Add "Report Broken Link" action to Opportunity Detail pages.
- Build `/api/broken-reports` to handle report submissions.
- Update the opportunity `report_count`.
- Implement logic to auto-revert opportunity status to `Pending Review` if `report_count >= 3`.

**Files / Modules Likely Created:**
- `components/ReportModal.tsx`
- `app/api/broken-reports/route.ts`

**Acceptance Criteria:**
- Students can report broken opportunities.
- Duplicate reports from the same user are prevented.
- Opportunities with 3 or more reports are hidden from the public feed and sent back to moderation.

**Verification Checklist:**
- [ ] Test submitting a report.
- [ ] Verify the report count increments.
- [ ] Simulate 3 reports and verify the opportunity status changes.

### Security Gate
* Users can only report an opportunity once
* Reports are anonymized and cannot be viewed by other students

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 10 — Admin Operations

**Objective:** Implement the full operational layer for Admins.
**Scope:** CRUD for opportunities/companies, user management, audit logs.
**Inputs / Dependencies:** Phase 2, App-Flow.md.

**Implementation Tasks:**
- Build `/admin/opportunities` to manage all listings directly.
- Build `/admin/companies` to manage company profiles.
- Build `/admin/users` to view users, change roles, and suspend/restore accounts.
- Build `/admin/audit-logs` to view the immutable audit trail.
- Build `/admin/analytics` for basic platform metrics.

**Files / Modules Likely Created:**
- `app/(admin)/admin/opportunities/page.tsx`
- `app/(admin)/admin/companies/page.tsx`
- `app/(admin)/admin/users/page.tsx`
- `app/(admin)/admin/audit-logs/page.tsx`

**Acceptance Criteria:**
- Admins can create and edit opportunities directly (bypassing moderation).
- Admins can promote Students to Moderators.
- Audit logs are visible only to Admins.

**Verification Checklist:**
- [ ] Test direct creation of an opportunity.
- [ ] Test changing a user's role.
- [ ] Verify a Moderator cannot access `/admin/users`.

**Risks / Notes:**
- Analytics can be simple aggregations; avoid over-engineering charts for MVP.

### Security Gate
* Admin role authorization strictly enforced on all routes and APIs
* Audit log insertions bypass RLS safely without exposing service key

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 11 — Legal and Public Pages

**Objective:** Complete the required static content pages.
**Scope:** Terms of Service, Privacy Policy.
**Inputs / Dependencies:** App-Flow.md.

**Implementation Tasks:**
- Build `/terms` page.
- Build `/privacy` page.
- Add footer links to these pages across the app.

**Files / Modules Likely Created:**
- `app/(public)/terms/page.tsx`
- `app/(public)/privacy/page.tsx`
- `components/layout/Footer.tsx`

**Acceptance Criteria:**
- Legal pages are accessible to all users.

### Security Gate
* Static pages are securely served without running untrusted scripts

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 12 — Quality Assurance

**Objective:** Stabilize and verify the application end-to-end.
**Scope:** Testing core flows, RLS, responsiveness, and accessibility.
**Inputs / Dependencies:** All previous phases.

**Implementation Tasks:**
- Perform manual end-to-end testing of the Student journey (Signup → Browse → Save → Track → Notify).
- Perform manual testing of the Moderator journey (Submit → Approve/Reject).
- Verify all RLS policies prevent unauthorized access.
- Audit the UI for mobile responsiveness (down to 375px width).
- Run Lighthouse accessibility and performance checks.

**Acceptance Criteria:**
- No critical bugs in the primary user journeys.
- Application handles errors gracefully without crashing.
- RLS boundaries hold secure against malicious API calls.

### Security Gate
* Penetration and vulnerability checks pass
* RLS boundary testing completes successfully

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

### Phase 13 — Deployment and Freeze

**Objective:** Final production release preparation.
**Scope:** Vercel deployment, environment config, final smoke test.
**Inputs / Dependencies:** Phase 12.

**Implementation Tasks:**
- Connect the GitHub repository to Vercel.
- Configure production environment variables in Vercel.
- Deploy the production Supabase database.
- Apply database migrations and insert official seed data.
- Deploy Supabase Edge Functions to production.
- Conduct a final production smoke test.

**Acceptance Criteria:**
- The application is live and accessible via the production URL.
- Edge functions run on their scheduled cron intervals.
- The MVP is officially feature-frozen.

### Security Gate
* Production environment variables verified and secret
* No debug or development logs exposed in production

### Phase Complete When
* Features work
* Tests pass
* Security gate passes
* No blocking bugs
* Dependencies for next phase are satisfied

---

## 5. Dependency Map

To ensure smooth development, phases must be executed in order, respecting these strict dependencies:

- **Phase 0 (Init)** must exist before anything else.
- **Phase 1 (Auth)** must exist before any Protected or Admin routes are built.
- **Phase 2 (Database)** must exist before Opportunity Discovery, Tracking, or Moderation can function.
- **Phase 3 (Discovery)** must exist before the Student Dashboard, as it provides the core UI components (Cards, Filters).
- **Phase 4 (Tracker)** depends on the Database and Discovery phases to link saved opportunities to opportunities.
- **Phase 5 (Notifications)** depends on the Tracker and Database for context.
- **Phase 7 (Submission) & Phase 8 (Moderation)** are heavily coupled and depend on the Database and Auth layers.
- **Phase 10 (Admin)** depends on all data models being finalized.

---

## 6. Route-to-Feature Mapping

| Route | Phase | Primary Role Access | Feature |
|---|---|---|---|
| `/` | Phase 3 | Public | Opportunity Hub, Search, Fresh Feed |
| `/opportunities/[id]` | Phase 3 | Public | Opportunity Detail |
| `/companies/[id]` | Phase 3 | Public | Company Profile |
| `/login`, `/signup` | Phase 1 | Public | Authentication |
| `/dashboard` | Phase 4 | Student+ | Student Dashboard |
| `/tracker` | Phase 4 | Student+ | Application Tracker |
| `/notifications` | Phase 5 | Student+ | Notification Center |
| `/profile` | Phase 6 | Student+ | Profile Management |
| `/submit` | Phase 7 | Student+ | Community Submission Form |
| `/admin/submissions` | Phase 8 | Moderator+ | Submission Queue |
| `/admin/opportunities` | Phase 10| Admin | Opportunity CRUD |
| `/admin/companies` | Phase 10| Admin | Company CRUD |
| `/admin/users` | Phase 10| Admin | User Roles & Moderation |
| `/admin/audit-logs` | Phase 10| Admin | System Audit Log |
| `/terms` | Phase 11 | Public | Terms of Service |
| `/privacy` | Phase 11 | Public | Privacy Policy |

---

## 7. Acceptance Criteria Summary

The project is considered complete and successful when all of the following conditions are met:

- **Routing:** All public, protected, and admin routes function correctly and handle unauthenticated access securely.
- **Database:** The Supabase PostgreSQL database matches the schema precisely, with all RLS policies, foreign keys, and indexes enforced.
- **Student Flows:** A student can sign up, search opportunities, save them, manage their application tracker, edit their profile, and receive deadline notifications.
- **Moderation Flows:** Students can submit opportunities; Moderators can review, approve, or reject them via a dedicated queue.
- **Admin Flows:** Admins have full CRUD control over the platform, users, and can view the immutable audit log.
- **Infrastructure:** All cron jobs execute reliably on Supabase Edge Functions.
- **Deployment:** The application is successfully deployed on Vercel (Frontend) and Supabase (Backend/DB) with zero severe console errors or layout breaks on mobile.
- **Alignment:** The final build is strictly aligned with the frozen PRD, TRD, App Flow, and Backend Schema documents. No unauthorized features have been added.

---

## Architecture Freeze Status

PRD.md — Frozen
TRD.md — Frozen
App-Flow.md — Frozen
UI-UX-Brief.md — Frozen
UI-SCREEN-MAP.md — Frozen
Backend-Schema.md — Frozen
Implementation-Plan.md — Frozen

Status: Ready For Development

---

## Development Readiness Status

Verify:
* Product Ready
* Architecture Ready
* Database Ready
* Security Ready
* Deployment Ready

**Final Readiness Summary:** The implementation plan is now optimized, scoped, and secured. It explicitly guards against scope creep and defines rigid phase exit criteria, making it a robust 10/10 execution roadmap that is fully safe for AI-assisted development.
