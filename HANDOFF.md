# Opportunity Radar — Project Handoff & Onboarding

> **Purpose of this document.** A single, self-contained brief you can hand to a new engineer *or* another AI agent so they can understand the whole system, run it locally, respect the conventions, and pick up the next piece of work without re-discovering everything. Written 20 Aug 2026.
>
> **Companion doc:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) — a feature-by-feature audit with completion %, security findings, and everything fixed to date. Read this file first, then that one for depth.

---

## 1. What Opportunity Radar is

A unified web platform for students to **discover opportunities, manage applications, build skills, and prepare for interviews.** It aggregates internships/jobs/hackathons from multiple sources, and layers two AI flagship features on top:

- **AI Search** — paste/attach a résumé, get matched, de-duplicated, quality-filtered internships (agentic, real sources, no junk).
- **Voice Mock Interview** — a real-time spoken interview (LiveKit voice agent) that scores you and writes a full report with model answers.

Plus the standard surface: search + filters, an application tracker (kanban), a résumé toolkit (builder/ATS/optimiser), certifications catalogue, a global community chat ("Hub"), an AI assistant, notes, notifications, and profile/settings.

**Audience:** students. **Stage:** substantial, submission-ready MVP (~90% complete overall). Two AI features are live and working end-to-end.

---

## 2. Architecture at a glance

```
┌─────────────────────────────┐        ┌──────────────────────────────────────┐
│  Next.js 16 app (frontend/) │        │  Supabase (cloud)                    │
│  — Vercel                   │◄──────►│  Postgres + Auth + Storage + Realtime│
│  31 pages, 53 API routes    │  RLS   │  project: pkfghzeeyqngpquaspuz       │
│  React 19, Tailwind v4      │        │  38 tables, RLS on all               │
└──────────┬──────────────────┘        └──────────────────────────────────────┘
           │  server-to-server, X-Internal-Secret gated
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Azure VM  172.198.161.108  (systemd + Caddy TLS)                             │
│  ┌──────────────────────────────┐   ┌──────────────────────────────────────┐ │
│  │ AI Search agent              │   │ Voice Interview agent + worker       │ │
│  │ agent.laxmansirvi.me         │   │ interview.laxmansirvi.me             │ │
│  │ (résumé → matched roles)     │   │ FastAPI + LangGraph + livekit-agents │ │
│  └──────────────────────────────┘   │ Deepgram STT · Gemini LLM ·          │ │
│                                      │ Kokoro TTS (self-hosted) · LiveKit   │ │
│                                      └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
           │
           ▼  LiveKit Cloud (WebRTC transport for the voice interview)
```

- **Frontend** is the product. Everything the user sees is Next.js on Vercel.
- **Two Python AI backends** live on one Azure VM, each behind Caddy TLS and gated by a shared `X-Internal-Secret` header (the browser never calls them directly — the Next.js server does).
- **Supabase** is the single source of truth for all user data, with Row-Level Security on every table.

---

## 3. Tech stack (actual versions in use)

| Layer | Choice | Version |
|---|---|---|
| Framework | **Next.js (App Router, Turbopack)** | 16.2.7 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | **Tailwind CSS v4** + Material-3 design tokens | ^4 |
| DB / Auth / Storage / Realtime | **Supabase** (`@supabase/supabase-js`) | ^2.107 |
| Drag & drop (tracker) | `@dnd-kit/core` | ^6.3 |
| Realtime voice | LiveKit (`livekit-client`, `@livekit/components-react`) | ^2.21 / ^2.9 |
| Toasts | `sonner` | ^2.0 |
| Validation | `zod` | ^4.4 |
| Tests | **Vitest** | ^4.1 |
| AI SDKs (assistant/search) | Vercel AI SDK + provider pool (Gemini, Groq, Mistral, OpenRouter, Ollama) | — |
| AI backends | Python · FastAPI · LangGraph · livekit-agents | — |

> ⚠️ **`AGENTS.md` warning that matters:** `frontend/AGENTS.md` says *"This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code."* Next 16 + React 19 + Tailwind v4 have breaking changes vs. older training data (async `params`, server components by default, RSC caching, the new CSP/`headers()` in `next.config.ts`). **Check the vendored docs before assuming an API.**

---

## 4. Repository layout — where things live

```
Opportunity radar/
├─ frontend/                      ← the Next.js app (this is 95% of the work)
│  ├─ app/
│  │  ├─ (auth)/                  ← login, signup, forgot-password, verify-email
│  │  ├─ (protected)/             ← everything behind auth (dashboard, search, tracker, …)
│  │  ├─ (protected-fullscreen)/  ← hub + résumé builder (no chrome)
│  │  ├─ api/                     ← 53 route handlers, incl. api/cron/* and api/hub/*
│  │  └─ actions/                 ← server actions (e.g. tracker.ts)
│  ├─ features/                   ← feature modules — THE main code home
│  │  ├─ opportunities/           ← search service, filters, cards, detail buttons
│  │  ├─ tracker/                 ← kanban board + stats (computeTrackerStats)
│  │  ├─ certifications/          ← catalogue browser + search
│  │  ├─ hub/                     ← community chat (realtime, components, hooks)
│  │  ├─ interview/               ← voice room, report, history (client side)
│  │  ├─ resume-toolkit/ & resume/← vendored Reactive Resume + our integration
│  │  ├─ notes/, assistant/, profile/, …
│  ├─ lib/                        ← supabase clients, cron-auth, ingestion, agent-client
│  ├─ types/                      ← shared types (opportunity.ts, database.types.ts, …)
│  ├─ tests/                      ← Vitest suite (58 files, 523 tests)
│  └─ next.config.ts              ← CSP, image domains, headers
├─ supabase/migrations/          ← SQL migrations (source of truth for DB changes)
├─ PROJECT_AUDIT.md              ← the detailed audit
└─ HANDOFF.md                    ← this file
```

**Convention:** a feature lives in `features/<name>/` (components, hooks, services, lib) and is mounted by a thin `app/(...)/<route>/page.tsx`. Server-only DB writes go in `app/actions/` or `app/api/`. Never put a `'use server'` export next to shared constants — a `'use server'` file may only export async functions.

---

## 5. Feature inventory & status

Scores are from `PROJECT_AUDIT.md` (✅ verified live · 🟡 built, spot-checked · ⚠️ needs work).

| Feature | Route(s) | Status | Completion |
|---|---|---|---|
| **AI Search** | `/ai-search` + Azure agent | ✅ live, tested | 95% |
| **Voice Mock Interview** | `/interview`, `/interview/[id]`, `/interview/history` + agent + worker | ✅ live, tested | 90% |
| **Application Tracker** | `/tracker` | ✅ audited this pass | 97% |
| **Opportunities / Search** | `/search`, `/opportunities/[id]` | ✅ audited this pass | 97% |
| **Community Hub** | `/hub` | ✅ audited this pass | 97% |
| **Certifications** | `/certifications` | ✅ audited this pass | 95% |
| **Auth** | `/(auth)/*` | 🟡 Supabase Auth, double-gated | 90% |
| **AI Assistant** | `/assistant` | 🟡 chat w/ opportunity attaching | 85% |
| **Notes** | `/notes` (+11 API routes) | 🟡 rich (folders, sharing, links) | 85% |
| **Résumé toolkit** | `/resume/*` | ✅ all 4 dead builder buttons implemented this pass | 90% |
| **Certifications/Tracker/Notifications/Profile/Settings/Support/Dashboard** | respective | 🟡 built & wired | 80% |

---

## 6. Data & backends

### Supabase (project `pkfghzeeyqngpquaspuz`)
- **Postgres** with **RLS enabled on all 38 public tables**; per-user ownership policies on every user-data table.
- Key tables: `opportunities`, `companies`, `opportunity_tags`, `application_tracker`, `bookmarks`, `certifications`, `hub_messages`, `profiles`, `achievements`, `recently_viewed`, `notes*`, `interview_sessions`, `interview_reports`, plus DeepInterview's `sessions`.
- **Search is powered by an RPC:** `search_opportunities_rpc(...)` (dynamic SQL, FTS + filters). Extended this pass to support `filter_company` + `filter_tags`. The frontend calls it first and falls back to a manual query builder if absent.
- **DB changes go through `supabase/migrations/*.sql`** — committed, timestamped, reproducible. Don't hand-edit the live DB without a matching migration file.

### AI Search backend (Azure — `agent.laxmansirvi.me`)
Agentic résumé→matches pipeline. Uses a **rotating AI key pool** (Gemini / Groq / Mistral / OpenRouter / Ollama) + Tavily for web search. Rate-limited, RLS-proven, filters out reels/junk.

### Voice Interview backend (Azure — `interview.laxmansirvi.me`)
FastAPI + LangGraph + `livekit-agents` worker. Pipeline: **Deepgram STT → Gemini LLM → Kokoro TTS (self-hosted, free, no rate limits) → LiveKit Cloud transport**, with Silero VAD + turn detection. Endpoints: `/api/prep`, `/api/session/{id}`, `/api/score`, `/api/session/{id}/live-result`. Scoring takes ~4 min (grades each competency + writes a model answer per question) — the frontend polls up to 8 min.

> The Python backends live in a **separate repo/dir** (DeepInterview is an open-source base at `ngoanpv/DeepInterview`, customised). This handoff is frontend-centric; treat the backends as gated services with the contracts above.

---

## 7. Environment variables (names + purpose — no secrets here)

Set in Vercel (frontend) and on the VM (backends). **Never commit values.**

| Var | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin reads (e.g. resolving other users' public Hub profiles) |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs |
| `AI_AGENT_URL` / `AI_AGENT_INTERNAL_SECRET` | Call the AI Search backend |
| `INTERVIEW_AGENT_URL` / `INTERVIEW_AGENT_INTERNAL_SECRET` | Call the Voice Interview backend |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Mint LiveKit tokens for the voice room |
| `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`/`OLLAMA_API_KEY` | AI provider pool (assistant/search) |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | (image/asset tooling) |
| `CRON_SECRET` | Gates `/api/cron/*` (see `lib/cron-auth.ts`) |

---

## 8. Run it locally

```bash
cd frontend
npm install
# create .env.local with the vars in §7 (ask the owner for values)
npm run dev          # Next dev server (Turbopack)
npm run test         # Vitest — 523 tests
npm run lint         # ESLint
npx tsc --noEmit     # typecheck (see caveat below)
```

- **Preferred preview:** the in-app Browser pane / Vercel preview. Never start a dev server just to look at a static deliverable.
- **Protected routes need a logged-in Supabase session.** Sign in through the UI; don't hardcode credentials.

---

## 9. House rules & conventions (read before writing code)

These are load-bearing — the codebase is consistent about them and reviewers/agents should stay consistent too.

1. **Never fabricate data.** A missing field is omitted, never filled with a placeholder or a fake signal (this is why "People also viewed" was renamed and stub badges were removed). If the DB doesn't have it, don't imply it.
2. **RLS + explicit ownership filter.** Every mutation re-checks `user_id = auth.uid()` *in addition to* RLS — defense-in-depth against an accidental policy change turning an id-only update into an IDOR.
3. **Search/filter state lives in the URL** (`useSearchFilters`), never in component state.
4. **DB changes = a migration file** in `supabase/migrations/` (timestamped), even when applied live. Keep the file and the live DB in sync.
5. **`SECURITY DEFINER` / grants are locked down** — anon can't call destructive functions; see the audit's security section before touching DB functions.
6. **Commit style:** conventional commits (`fix(search): …`), one logical change per commit, and end messages with the `Co-Authored-By` trailer. The owner works step-by-step and commits immediately after each verified step.
7. **`typescript.ignoreBuildErrors: true`** in `next.config.ts` — the build tolerates TS errors (all ~19 remaining live in the **vendored** Reactive Resume toolkit). **Don't add new ones** in first-party code; run `tsc` and keep first-party clean.
8. **Lint clean is the bar.** When an ESLint rule must be broken (e.g. `<img>` for external favicons, an intentional effect-dep omission), add a one-line justification comment next to the disable — that's the existing pattern.
9. **Pure logic gets a unit test.** E.g. `computeTrackerStats`, the search sanitizer. Extract logic from components when it's worth testing.

---

## 10. Deployment

- **Frontend → Vercel.** Project `opportunity-radar` (`prj_LZz1jTnQIBn2168AB2gjANBV98Yr`, team `team_ZoKBUzeivolBMQGdfcufbDXh`). Pushing to **`restore-june19-clean`** auto-builds. Framework: Next.js, bundler: Turbopack.
- **Backends → Azure VM** `172.198.161.108` (systemd services + Caddy TLS). Not auto-deployed from this repo.

> ⚠️ **Known deployment caveat (needs the owner's dashboard).** Pushes to `restore-june19-clean` currently produce **branch/preview deploys** (`target: null`) that update the **branch-alias URL**, not the pretty `opportunity-radar-six.vercel.app` production alias — that alias is still pinned to an older *promoted* build. **To fix once:** Vercel → Project → Settings → Git → set **Production Branch = `restore-june19-clean`** and save (or promote the newest build). After that, pushes go straight to production. Until then, **the always-current demo URL is the branch alias:**
> `https://opportunity-radar-git-restore-ju-6faa4e-laxman-sirvi-s-projects.vercel.app`

### Cron jobs (`vercel.json`, Hobby tier = max once/day each)
Ingestion refreshers (Unstop, Internshala, providers, employers) run nightly; `link-sweep` + `certification-link-sweep` prune dead links; `notifications`, `maintenance`, `sweep-interviews`, `purge-interviews`, `refresh-certifications` (weekly). All gated by `CRON_SECRET`.

---

## 11. What to work on next (prioritised) — and how

### 🔴 High (reviewer-visible / one-time)
1. **Point production at the right build** — the Vercel Production-Branch setting above. *(dashboard, ~1 min)*
2. **Enable leaked-password protection** — Supabase → Auth → Policies (checks HaveIBeenPwned). *(dashboard toggle)*
3. **Drop 4 stale `opportunities_backup*` tables** — SQL is in `PROJECT_AUDIT.md` §5; the `DROP` was blocked by a safety classifier in tooling, so run it in the Supabase SQL editor. *(declutter + clears 8 advisories)*

### 🟡 Medium (finish the polish)
4. ~~**Résumé toolkit** — dead buttons~~ — ✅ **done.** There were **4**, not 3; all are implemented (Download PDF, Preview Mode, Undo, Redo), none relabelled. See audit §8. **Still open here:** the 19 TS errors in the vendored code — worth clearing for a polished submission.

   > **If you touch the builder layout:** panel visibility is written as one mutually exclusive class string per state, not layered conditionals. `cn` is twMerge, which keeps `hidden` and `md:flex` in separate responsive groups, so appending `hidden` to a panel that already carries `md:flex` leaves it visible from `md` up. There's a comment in the file — don't "simplify" it away.
5. **AI Assistant / Notes** — built and wired but not exhaustively tested end-to-end; do a full pass (attach flows, sharing, link targets). **This is the biggest remaining surface and the natural next feature audit.**

   > **Notes' security layer was already audited clean (20 Aug 2026) — don't redo it, start from behaviour.** All 11 API routes authenticate; `assertOwned()` gates every share operation; the public `app/notes/shared/[slug]/page.tsx` correctly checks `link_access === 'view'`, excludes trashed notes, re-sanitises HTML on output, forces `dynamic`, and sets `noindex`. Service-role use is narrow and documented. No defects found. What remains untested is the *behaviour*: folders, link targets, attachments/uploads, bulk ops, and the share dialog's UX.
6. **Auth flows** — spot-checked, not exhaustively exercised (password reset, email verification edge cases).

### 🟢 Low (post-submission / perf)
7. **DB perf advisors** (216, all low-impact at this scale): wrap `auth.uid()` as `(select auth.uid())` in RLS policies (78×), consolidate overlapping permissive policies (87×), drop unused indexes. See audit §6.
8. **Strip 15 `console.log`s** (none leak secrets; verified).
9. **Landing hero** — the 3D/Spline robot is the heaviest client cost; consider lazy-loading.

### How to approach a task here
- Read `PROJECT_AUDIT.md` for the feature's current state, then the feature dir under `features/<name>/`.
- Reproduce the issue (protected routes need a login), find the smallest fix, keep it lint/type-clean, add/adjust a test if there's pure logic.
- If it touches the DB, write a migration. If it touches search, remember the **RPC is the primary path** — changing search means changing `search_opportunities_rpc` *and* the service's fallback, then testing the RPC directly in SQL.
- Commit with a conventional message; the owner reviews per-step.

### Product roadmap (beyond bug-fixing)
Real "People also viewed" (there's a `recently_viewed` table to back it), richer AI-search filters, résumé-builder feature completion, and broader test coverage of the 🟡 features are the natural next themes.

---

## 12. Testing & quality gates

- **Vitest:** `npm run test` → **523 tests / 58 files, all passing.** Tests live in `frontend/tests/`.
- **Lint:** ⚠️ *corrected 20 Aug 2026 — this previously claimed all first-party code was ESLint-clean; it is not.* `npm run lint` reports **362 problems (216 errors, 146 warnings)**. The **audited features are** clean (`opportunities`, `search`, `hub`, `tracker`, `certifications` produce zero output) — but `scripts/` (66 errors), `app/` (28), `lib/` (27) and `tests/` (23) are not, and `lib/ats-checker` + `lib/resume-optimizer` are first-party, not vendored. **The rule still stands for code you touch:** leave every file you edit lint-clean. See `PROJECT_AUDIT.md` §4 for the full breakdown.
- **Types:** `tsc --noEmit` — first-party clean; the only errors are in the vendored résumé toolkit (non-blocking, `ignoreBuildErrors` on).
- **Security:** RLS on all tables; the one ERROR-level cross-user leak was closed; all `SECURITY DEFINER` functions hardened. Details in audit §5.

---

## 13. Fast start for a new AI agent

> Paste this section as the agent's first instruction.

1. You're working on **Opportunity Radar**, a Next.js 16 / React 19 / Tailwind v4 student-opportunities platform on Vercel, backed by Supabase (RLS everywhere) and two gated Python AI backends on an Azure VM.
2. **Read `HANDOFF.md` (this file) fully, then `PROJECT_AUDIT.md`.** Then read `frontend/AGENTS.md` — the framework has breaking changes vs. older knowledge; verify APIs against `node_modules/next/dist/docs/`.
3. Code lives in `frontend/features/<name>/`; routes are thin `app/**/page.tsx`. DB changes require a migration in `supabase/migrations/`.
4. **Respect the house rules in §9** — especially *never fabricate data*, *RLS + explicit ownership filter*, *URL-driven search state*, and *keep first-party lint/types clean*.
5. Protected routes need a real login; don't hardcode credentials or call the AI backends from the browser.
6. Pick the next task from §11, make the smallest correct change, keep tests green (`npm run test`), and commit with a conventional message.
```
