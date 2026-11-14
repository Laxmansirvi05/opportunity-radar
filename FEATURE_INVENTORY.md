# Feature Inventory — Opportunity Radar

Audit date: 14 Nov 2026 · Code at `d9d74e0` (= production).

**How to read the status columns**
- *Implementation*: Complete / Partial / Missing, judged from code.
- *Functionality*: PASS / FAIL / PARTIAL / BLOCKED / NOT TESTED, judged from execution only. Code existing is never counted as PASS.
- Signed-in flows are **BLOCKED** in this audit environment. It has no service-role key, no AI provider keys and no interactive Google sign-in, and no test accounts were created on the production database. Where possible, behaviour was verified directly against the production database (rolled-back RLS tests, RPC calls, production telemetry) instead.

Inventory size: 31 pages · 54 API routes · 11 cron jobs · 36 DB tables · 7 storage buckets.

## Public surface (tested end-to-end on localhost production build)

| Feature | Route | Backend / DB | Impl. | Functionality | Evidence | Issues | Priority |
|---|---|---|---|---|---|---|---|
| Landing page + live stats | `/` | `landing_stats` RPC | Complete | **PASS** | 200 at 7 viewports; shows "2,900+ opportunities / 700+ companies", matching the RPC (2,921 / 715); LCP 172–436 ms | Header wraps at 320 px | Low |
| Log in (email + password) | `/login` | Supabase Auth, Turnstile, `login_attempts` | Complete | **NOT TESTED** (needs account) | Page renders at all viewports, no console errors | Weak 6-char password policy | Medium |
| Sign up | `/signup` | Supabase Auth, `handle_new_user` trigger | Complete | **PARTIAL** (rendered only) | Production trigger still ignores `full_name` → the name becomes the email prefix (DB evidence) | Unapplied migration | High |
| Google sign-in | `/login` → `/auth/callback` | Supabase OAuth (PKCE) | Complete | **BLOCKED** | Requires interactive Google consent. Callback error paths tested: no code → `/login?error=Invalid authentication callback` | — | — |
| Email verification / resend | `/verify-email` | Supabase Auth, `email_resend_logs` | Complete | NOT TESTED | Renders; cooldown UI present | — | — |
| Forgot / reset password | `/forgot-password` | Supabase Auth recovery | Complete | NOT TESTED | Renders | — | — |
| Route protection | middleware `proxy.ts` | `auth.getUser()` | Complete | **PASS** | `/search`, `/dashboard`, `/tracker` → 307 `/login?next=…` | All discovery requires an account (see Product notes) | Medium |
| Privacy policy / Terms | `/privacy`, `/terms` | static | Complete | **PARTIAL** | Renders. Content gaps: undisclosed providers, deletion claim false (see AI and security audits) | Legal review needed | High |
| Shared note (public link) | `/notes/shared/[slug]` | service-role read of `note_shares` | Complete | **FAIL (security)** | Any user can create a share for someone else's note (rolled-back DB test, SEC-02). Unknown slug → 404 in prod (500 locally only because no service key) | SEC-02 | **P0** |

## Opportunity discovery

| Feature | Route | Components | Backend API / DB | Impl. | Functionality | Evidence | Issues | Priority |
|---|---|---|---|---|---|---|---|---|
| Search (keyword) | `/search` | `search-input`, `opportunity-search-card` | `search_opportunities_rpc` | Complete | **PARTIAL** | Case-insensitive, multi-word and injection-safe: PASS. City synonyms: FAIL (Bangalore 0 vs Bengaluru 1). Description text not searched | No synonyms; 165 ms DB time at 2.9k rows | Medium |
| Filter: Category | sidebar | `filters-sidebar` | RPC `filter_category` | Complete | **PARTIAL** | Works, but "Workshop" always returns 0 (never ingested); Scholarship 2 | Dead option | Medium |
| Filter: Mode (Remote/Hybrid/Onsite) | sidebar | | RPC `filter_mode` → `opportunities.mode` | Complete | **FAIL** | Remote → 289 rows while 1,399 have `is_remote=true`; Hybrid → 0 | Filters the 90%-NULL column | **P1** |
| Filter: Paid / Free | sidebar | | RPC `filter_is_paid` | Complete | **FAIL** | Paid → 16, Free → 1 (99% of `is_paid` NULL) | Silently hides 99% of results | **P1** |
| Filter: Location | sidebar | | ILIKE on `location` | Complete | PARTIAL | ILIKE works; no synonyms | | Medium |
| Filter: Skills, Company | sidebar | `SkillsFilter` | RPC `filter_tags`, `filter_company` | Complete | PASS (SQL) | `filter_tags=[react]` returned results | | — |
| Filter: Deadline window, Freshness | sidebar | | RPC | Complete | PASS (SQL) | | Amazon deadlines are fabricated, so "closing in 7 days" includes invented dates | P1 |
| Filter: Experience | sidebar | flag `ENABLE_EXPERIENCE_FILTER=false` | RPC | Partial (hidden) | N/A | Column 100% NULL; correctly hidden | — | — |
| Sorting (relevance/newest/deadline) | `/search` | | RPC | Complete | PASS (SQL) | Relevance pushes senior titles down | | — |
| Recent searches | `/search` | `use-recent-searches` | localStorage | Complete | NOT TESTED | Hydration fix shipped in #8 | | — |
| Opportunity detail | `/opportunities/[id]` | detail components | `opportunities`, tags, company | Complete | NOT TESTED (auth) | Description sanitizer probe: PASS (XSS neutralised) | Detail pages are login-only, so no sharing or SEO | Medium |
| Bookmarks / Saved | `/profile/saved`, bookmark button | `use-bookmark` | `bookmarks` | Complete | NOT TESTED | RLS correct. **Bookmarks are silently deleted when the listing expires (cascade)** | Data loss for users | P1 |
| Recently viewed | dashboard | | `recently_viewed` | Complete | NOT TESTED | 17 rows in prod | | — |
| Dashboard | `/dashboard` | `features/dashboard` | profiles, bookmarks, tracker, opportunities, recently_viewed | Partial | NOT TESTED | The opportunity list is the **6 newest published listings for every user** (`order posted_at desc limit 6`, `dashboard/page.tsx:47-53`); the "recommendations" card is profile-completion tips. `lib/recommendation-engine` (unit-tested) is **not imported anywhere** | No personalisation despite profile skills | **P1** |
| Notifications (in-app) | `/notifications`, `/api/notifications*` | | `notifications`, cron `notifications` | Complete | NOT TESTED | 3 rows in prod. Cron alerts only on tracker items with status **Saved** whose deadline is within 48 h; bookmarks are not covered | Narrow coverage | Medium |
| Email alerts | `/settings` toggle | | `profiles.email_alerts` | **Missing** | N/A | No email provider in code; UI honestly says "nothing is sent today" | UI-only toggle | Low |
| Certifications catalogue | `/certifications` | `features/certifications` | `certifications` (23,389), crons refresh & link-sweep | Complete | NOT TESTED (auth) | Build-time call to `certification_provider_counts` works with network | — | — |

## Ingestion (backend)

| Feature | Route | Implementation | Functionality | Evidence | Priority |
|---|---|---|---|---|---|
| Internshala ingestion | cron `refresh-internshala` 21:00 UTC | Complete | **PARTIAL** | Rows refreshed through 13 Nov but no `ingestion_logs` since 9 Oct (runs do not finish); 28% of sampled live listings closed | P1 |
| Unstop ingestion | cron `refresh-unstop` 20:00 UTC | Complete | PARTIAL | Rows refreshed; no log since 10 Oct | P1 |
| Unstop competitions provider | — | Implemented, **not wired** to any cron | **FAIL** (never runs) | knip: `UnstopCompetitionsProvider` unused | P1 (only 13 competitions, 2 scholarships) |
| Employer ATS (Greenhouse/Lever/SmartRecruiters) | cron `refresh-employers` 19:00 UTC | Complete | **PARTIAL / FAIL (Lever)** | No log since 9 Aug; Lever rows not updated since 2 Nov; 22–28% of sampled listings closed | P1 |
| Amazon | cron `refresh-providers` 22:00 UTC | Complete | **PARTIAL** | Logs SUCCESS nightly; **deadline = now + 30 days is fabricated** | **P1** |
| YC (HN jobs) | cron `refresh-providers` | Complete | **FAIL** | 0 inserted / 330 rejected in 14 days; the 2 live rows are generic careers pages | P2 |
| Maintenance (expire / deadline sweep) | cron `maintenance` 23:00 UTC | Complete | PASS | Logs SUCCESS nightly | — |
| Link sweep | cron `link-sweep` 02:00 UTC | Complete | **PARTIAL** | Status-code-only; all 20 closed listings in the sample were marked 200 | P1 |
| Queue producer/consumer | scripts `run-producer`, `run-worker` | Abandoned | N/A | `ingestion_queue` 0 rows; `QueueProducerService` unused | Cleanup |

## AI features

| Feature | Route | Backend | Dependencies | Impl. | Functionality | Evidence | Priority |
|---|---|---|---|---|---|---|---|
| AI Assistant (full page) | `/assistant` | `/api/assistant` | AI gateway (Gemini → OpenRouter → Groq → Mistral → Cloudflare), DB search | Complete | **BLOCKED** | 401 unauth (PASS). Prod telemetry: 6 OK, 2 `all_failed` at 45 s, last call 9 Oct | — |
| Quick Assistant (robot popup) | floating robot | same route, `mode:"quick"` | same | Complete | BLOCKED | — | — |
| AI Search (résumé-driven matching) | `/ai-search` | `/api/ai-search`, `[jobId]` | **external** agent `AI_AGENT_URL` (scraper + headless Chromium) | Complete (client) | **BLOCKED** | 9 jobs ever: 7 complete, 2 failed; last 9 Oct | — |
| AI Voice Interview | `/interview`, `/interview/[id]`, `/interview/history` | `/api/interview/*` | **external** DeepInterview service + LiveKit | Complete (client) | **BLOCKED** | `interview_sessions` = **0 rows** in prod (never used or purged) | P2 (verify viability) |
| ATS Checker (v2) | `/resume/ats` | `/api/resume/ats-check`, `ats-history` | AI gateway + `lib/ats-checker` | Complete | BLOCKED | 13 reports in prod; JD extraction measured at 124 s once, evidence eval 40 s | P2 (latency) |
| Résumé Optimiser / Copilot | `/resume/copilot` | `/api/resume/optimization*` | AI gateway, fabrication guard | Complete | BLOCKED | 7 optimisations in prod; `tests/resume-fabrication-guard.test.ts` passes | — |
| Résumé parse (upload → builder) | `/resume/upload` | `/api/resume/parse` | AI gateway | Complete | BLOCKED | Parser 64 s (Gemini) / 3 s (Cloudflare) in telemetry | P2 |
| Legacy ATS analyze | — | `/api/ats/analyze` + `lib/ats-engine` | AI | **Orphaned** | N/A | No frontend caller (duplicate engine) | Cleanup |
| Legacy bullet optimise | — | `/api/resume/optimize` | AI | **Orphaned** | N/A | No frontend caller | Cleanup |

## Résumé toolkit (non-AI)

| Feature | Route | Backend / DB | Impl. | Functionality | Notes |
|---|---|---|---|---|---|
| Résumé hub | `/resume` | `/api/resume/list` | Complete | NOT TESTED | |
| Résumé Builder (editor, templates, PDF export) | `/resume/builder`, `/resume/builder/[id]` | `resumes`, `@react-pdf/renderer`, vendored Reactive Resume `packages/*` | Complete | NOT TESTED | Vendored MIT code without licence notice; 55 vendored/feature unit tests never run |
| Résumé picture upload | builder | `/api/resume/picture`, `avatars` | Complete | NOT TESTED | |
| Résumé download | — | `/api/resume/[id]/download` | Complete | NOT TESTED | |
| Old builder / renderer engine | — | `features/resume-toolkit/components/{builder,engine}` | **Dead** | N/A | 27+ unreferenced files with raw-HTML sinks |

## Productivity and community

| Feature | Route | Backend / DB | Impl. | Functionality | Notes / Issues |
|---|---|---|---|---|---|
| Application tracker (kanban) | `/tracker` | server actions, `application_tracker` | Complete | NOT TESTED | RLS correct; unit tests pass. "Saved" cards are deleted when the listing expires |
| Notes workspace (rich text, folders, links, attachments, sharing) | `/notes` | `/api/notes/*`, 6 tables, `note-attachments` bucket | Complete | **FAIL (security)** | SEC-02/03 (sharing RLS), SEC-07 (public attachments) |
| Hub (student chat) | `/hub` | `/api/hub/*`, `hub_messages`, `hub-attachments` | Complete | NOT TESTED | Profiles expose email (SEC-06); 9 messages total |
| Profile | `/profile` | server actions, `profiles`, `achievements`, `avatars` | Complete | NOT TESTED | Locked fields enforced by trigger |
| Settings (alerts, public profile, delete account) | `/settings` | `delete_user` RPC | Partial | NOT TESTED | Deletion leaves storage files (SEC-04); the "public profile" toggle is reserved |
| Support / FAQ | `/support` | static + `mailto:support@opportunityradar.com` | Complete | PARTIAL | Verify the project owns `opportunityradar.com`; the app is served from `*.vercel.app` |
| Command palette | global | `features/command-palette` | Complete | NOT TESTED | |
| Floating 3D robot (Spline) | global | external Spline runtime + DRACO from gstatic | Complete | NOT TESTED | Heavy asset; decorative |

## Unused or never-populated product surface

`saved_searches` (0 rows, no code references it), `resume_versions` (0), `reports` (0 rows; a "Report broken link" button writes here, but **no moderation UI** reads it), `report-evidence` bucket (unused), `audit_log` (0), moderator/admin roles (no admin UI), `ingestion_queue` (0), Workshop category (0), `experience_level` / `employment_type` columns (100% NULL).
