# Handoff Prompt — Opportunity Radar

> **How to use this file.** Paste the whole thing as your first message to the incoming
> agent, or say: *"Read `docs/AGENT-HANDOFF-PROMPT.md` and follow it."*
> It is written to be read by an AI agent, not by a person.

---

You are picking up an in-flight project. Someone worked on it before you and left the
codebase in a known, verified state. **Do not re-audit it.** A full audit was completed on
10 August 2026 and its findings are current. Your job is to continue the work, not to
rediscover it.

---

## 1. What this product is, and why

**Opportunity Radar** is a platform for Indian students looking for internships, jobs,
hackathons, competitions and scholarships.

The problem it solves: opportunities are scattered across Unstop, Internshala, company
career pages and a hundred Greenhouse/Lever boards. A student cannot watch them all, misses
deadlines, applies with a resume that never passes the ATS filter, and has no way to
practise interviewing. Existing aggregators are stale, full of dead links, and mostly
recycle the same listings.

The bet is that **trustworthiness is the product**. Anyone can scrape 10,000 listings. The
value is in 4,000 listings that are real, live, deduplicated, and link to an actual job
posting rather than a careers homepage.

That principle governs every decision here. Read it twice, because most of the rules below
are consequences of it.

### The six features

| Feature | What it does | State |
|---|---|---|
| **Hub** | WhatsApp-style group chat between students on the platform | 0% — not started |
| **Search** | Multi-provider aggregation, 24h auto-refresh, auto-expiry of dead listings | 85% |
| **Tracker** | Kanban: Saved → Applied → Interview Scheduled → Selected / Rejected | 90% |
| **Resume toolkit** | Build from scratch · extract & edit · ATS score · **optimisation** | 55% |
| **AI Search** | Upload resume → a separate AI agent returns 5–10 scored matches | 50% (code done, agent not deployed) |
| **AI Voice Interview** | 10–15 min voice conversation + scored report | 2% (lives in another repo) |

**Overall: ~63% complete.**

---

## 2. How the owner wants you to work

These are the owner's own rules from earlier sessions. They are not negotiable, and
ignoring them is the fastest way to break their workflow.

1. **One step at a time.** Finish a feature to 100% before starting the next. Do not open
   three fronts at once.
2. **Dual verification.** You verify structure, backend and correctness. **The owner
   verifies UX.** Present your work and let them look before you call it done.
3. **Commit the moment you both agree a piece is complete.** Do not batch up a week of
   work into one commit.
4. **An honest report of what is still broken beats a clean report that is not true.**
   If you could not verify something, say so and say why.

### Communication

The owner is the product decision-maker and reads carefully. Give them:
- What you changed and **why**, in plain language
- Real evidence — a command output, a query result, a test count
- What you could **not** verify, stated plainly
- The one decision that is theirs to make, if there is one

Do not pad with reassurance. Do not claim something works because it compiles.

---

## 3. Hard rules — violating these causes real damage

### Never
1. **Never run `supabase db push`.** Several older migrations contain bulk `INSERT`
   statements and will duplicate the 4,175-row live catalogue. Apply migrations
   **individually** and verify each one. Working command:
   ```bash
   npx supabase db query --linked < supabase/migrations/<file>.sql
   ```
2. **Never trust a `head: true` count query to prove a table exists.** PostgREST returns
   `count: null` with **no error** for a missing table. Always use a real row select and
   read the error code. This exact mistake produced a false all-clear during the audit.
3. **Never sign in as a user.** The five accounts in `auth.users` are real people,
   including people who are not the owner. Do not mint sessions, do not use passwords.
   If a check needs a logged-in session, say so and mark it unverified — or render the
   component at a temporary unprotected route, screenshot it, and delete that route.
4. **Never trigger ingestion accidentally.** `ENABLE_OPP_INGESTION=true` is in
   `.env.local`. Ingestion only fires through `/api/cron/*`, which is fail-closed on
   `CRON_SECRET` — do not set that variable locally.
5. **Never weaken a test to make it pass.** Never suppress a type error instead of fixing
   it. Never silence an error with try/catch.
6. **Never commit secrets.** `.env.local` holds 11 live API keys and is correctly
   gitignored. Keep it that way.
7. **Never fabricate a number shown to a student.** See §4.

### Do not delete these — they look dead but are not
- `packages/ui`, `packages/schema`, `packages/pdf` etc. An automated scan flags ~45 files
  as unimported. **False positive** — they resolve through the `@reactive-resume/*`
  tsconfig path aliases.
- `src/providers/opportunities/ingestion/QueueConsumerService.ts` and
  `QueueProducerService.ts` — imported by `scripts/run-cron.ts`, `run-worker.ts`,
  `run-producer.ts`, and `npm run cron:consume`.

---

## 4. The one principle that matters most

**Never show a student a number you made up.**

This is not a style preference. A student will rewrite a real resume, or apply to a real
job, based on what this product tells them. A fabricated ATS score is worse than no score.

Concretely, this is already enforced in the codebase and you must not undo it:

- **`lib/resume-optimizer/fabrication-guard.ts`** rejects any AI-generated resume that
  invents an employer, institution, degree, date, metric, project or skill. If generation
  fabricates twice in a row, the correct outcome is **failure with an honest message** —
  not a third attempt, and never shipping the output anyway.
- **ATS scores come from `calculateAtsV2Score()`**, the deterministic engine. Never from
  the model's own claim about how good its output is.
- A previous session found `/resume/copilot` rendering a hardcoded "68" score. It was
  replaced with an honest "still being built" page rather than merely hidden, because the
  route was still directly reachable.
- The AI Search progress stages are labelled *indicative* because the agent exposes no
  real progress. A fake percentage would be a lie.

If you find yourself writing a placeholder number into UI, stop.

---

## 5. Current state — verified 10 Aug 2026

| Check | Result |
|---|---|
| Production build | ✅ passes |
| Test suite | ✅ **266 / 266** across 30 files |
| TypeScript | ⚠️ **36 errors — this is the accepted baseline.** Do not add to it. Do not "fix" it by suppressing |
| ESLint | ⚠️ ~343 errors (mostly `no-explicit-any`). Keep files *you touch* clean |
| Live catalogue | 4,175 listings, **98.7% re-verified within 24h** |
| Schema | ✅ all 24 required objects reachable |

### Infrastructure
- **App:** Next.js 16.2.7, App Router. Note: `middleware.ts` is renamed **`proxy.ts`** in
  this version. Read `node_modules/next/dist/docs/` before using an unfamiliar API — this
  Next.js has breaking changes versus older training data.
- **Database:** Supabase, project `pkfghzeeyqngpquaspuz`, ap-south-1. CLI is authenticated.
- **Hosting:** Vercel, project `opportunity-radar`, root directory `frontend`.
  **Production branch is `restore-june19`** — not `main`. Pushing it deploys to production.
  Live at `https://opportunity-radar-six.vercel.app`.
- **CRON_SECRET is set in production** (verified: the health endpoint returns 401, not 503).

### Already fixed — do not redo
Seven issues, four critical. Four missing tables, a missing `service_role` GRANT on
`notifications` that broke the nightly cron, a missing storage bucket, the copilot mockup,
and a schema guard to stop drift recurring. Full detail with evidence in
`docs/ISSUE-TRACKER.md`.

---

## 6. Documents to follow

Read these three, in this order. Ignore everything else in `docs/` unless you have a
reason — much of it is stale and marked for deletion.

| Document | What it gives you |
|---|---|
| **`docs/ISSUE-TRACKER.md`** | **Start here.** Every known issue, what is fixed, the evidence, and what is next. This is the living record — **you must update it as you work.** |
| **`docs/AUDIT-2026-08-10.md`** | Full system audit. Feature-by-feature state, all data-quality numbers, the security review, the precise list of files safe to delete |
| **`docs/AI-FEATURES-HANDOFF.md`** | AI Search and AI Voice Interview — where the code lives on disk, the architecture, deployment plan, and the contract to agree with the other agent |

Also useful, still accurate: `docs/INGESTION-ARCHITECTURE.md`, `docs/PRODUCTION-PLAN.md`,
`docs/Backend-Schema.md`, `docs/TRD.md`, `docs/PRD.md`.

### Keeping the tracker honest
`docs/ISSUE-TRACKER.md` has one rule: **nothing moves to ✅ Fixed without evidence** — a
command output, a query result, or a test. "Should work now" stays In Progress. Record the
date, and treat fixed-locally and fixed-in-production as different states.

---

## 7. Your next task — finish Resume Optimisation

This is the owner's stated priority feature. It is roughly 45% done: the hard, correctness-
critical parts are built and tested; what remains is generation, scoring and presentation.

### What the owner asked for, in their words

- Student uploads their resume + a job description + the company name
- Show the **real** ATS score of the uploaded resume — *"make sure not to hide the ATS
  score… it should be the reality"*
- Suggest improvements: **projects, courses, skills, education**
- **Never suggest work experience** — *"that cannot be done without an interview call"*
- Generate **two** downloadable PDF resumes:
  - **Resume A** — same facts, better format, vocabulary and power words
  - **Resume B** — aligned to the job description, incorporating the suggested work
- Both must **look human-made, not AI-generated.** Professional format, no colours
- **Checklist gate:** *"he will get checklist of suggested project, once he check all then
  he can download resume b — without checking it he can't"*
- **Persistence:** *"resume a and b and ats score, suggestion should get stored in that
  feature even after logout, so whenever he completed the project he can download it"*
- **Adaptive:** *"it is not necessary to always add all new projects — if his projects are
  good enough according to jd then just add 1 or zero new projects"*
- **Tiers:** *"if uploaded ats score is 80+ then only generate resume a… and if ats score
  is 90+ then tell 'your resume is already strong' so no need to generate resume"*

### What already exists — read before writing anything

| File | State |
|---|---|
| `lib/resume-optimizer/tiers.ts` | ✅ Done, **16 tests**. Tier thresholds; suggestions derived from the ATS V2 evidence matrix, so adaptivity is structural — a fully-evidenced resume yields zero suggestions. `experience_level` excluded by design |
| `lib/resume-optimizer/fabrication-guard.ts` | ✅ Done, **12 tests**. Catches invented employers, institutions, degrees, dates, metrics, projects, skills |
| `lib/resume-optimizer/generate.ts` | ⚠️ **Written but not wired.** Zero importers. Resume A and B prompts with anti-AI-tell rules, schema validation, and a single guarded retry |
| `resume_optimizations` table | ✅ Exists in production, 20 columns, RLS on, granted |
| `app/(protected)/resume/copilot/page.tsx` | Honest "still being built" placeholder — **this is what you replace** |

### What to build, in order

1. **Wire generation.** Create the API route that runs a full optimisation: parse the
   resume, score the baseline with `calculateAtsV2Score()`, decide the tier via
   `decideTier()`, derive suggestions via `deriveSuggestions()`, and persist the run.
2. **Score both generated resumes with `calculateAtsV2Score()`** — the real engine. Never
   the model's claim. Store `polished_score` and `target_score`.
3. **ATS-safe PDF export.** Single column, no tables, no colour, real embedded text layer
   (not an image). `@react-pdf/renderer` is already installed. A PDF that a parser cannot
   read defeats the entire feature — verify by extracting text back out of your own output.
4. **UI**, replacing the placeholder: upload, baseline score, tier message, the suggestion
   checklist with its download gate, and both downloads.

### Things that will bite you

- **The checklist gate is the safety mechanism, not a UX nicety.** Resume B presents
  suggested work as completed accomplishments. Releasing it before the student confirms
  the work exists hands them a resume making claims they cannot defend in an interview.
- **The target score is a projection**, not a measurement. Label it as such in the UI.
- **Tier 90+ generates nothing.** Do not "helpfully" generate anyway. Telling a strong
  candidate their resume is weak to justify a feature is dishonest.
- **Persistence must survive logout.** A student is told to build a project, returns two
  weeks later, ticks it off, and downloads Resume B. That is the core flow.
- Rate limits: `resume_polish` and `resume_target` are declared `AIFeature`s but have **no
  entry in `RATE_LIMITS`**, so they are currently unlimited. See SEC-01.

---

## 8. After that

In priority order, with full detail in `docs/ISSUE-TRACKER.md`:

1. **DATA-01** — 376 listings link to a search/listing page instead of the job. The student
   clicks Apply and lands on a careers homepage. Stripe 126, Databricks 125, MongoDB 52,
   HighRadius 44, Fivetran 29. Rebuild the per-job URL from `gh_jid`, or drop the listing.
2. **SEC-01** — AI rate limiting covers only 4 of 17 features. `checkRateLimit` does
   `if (!limit) return true`, so most features are unlimited and an authenticated user can
   drain the provider quota.
3. **DATA-02** — Internshala is 73% dead (27 of 37 listings closed).
4. **DATA-03** — link verification never runs; `link_status` is NULL on all 4,175 rows.
   A full nightly sweep is ~7 minutes at concurrency 10.
5. **Deploy the AI Search agent** — see `docs/AI-FEATURES-HANDOFF.md`.

**Do not start Hub or AI Voice Interview** without asking. Hub is untouched, and the voice
interview is being built by a different agent in a different repository.

---

## 9. Useful commands

```bash
# from frontend/
npm run dev              # dev server
npm run build            # production build — must pass
npx vitest run           # 266 tests — must stay green
npx tsc --noEmit         # 36 errors is the baseline; do not add
npx eslint <files>       # keep files you touch clean
```

```bash
# from repo root — run SQL against production. Read-only first, always.
npx supabase db query --linked < /path/to/query.sql
```

Before you finish any database work, run the schema guard against production and confirm
all 24 objects report `ok`.

---

## 10. Start here

1. Read `docs/ISSUE-TRACKER.md` end to end.
2. Read the three resume-optimiser files in §7 so you know what exists.
3. Tell the owner your plan for finishing Resume Optimisation before you write code.
4. Build it in the order given, committing each verified piece.
5. Update `docs/ISSUE-TRACKER.md` as you go — with evidence.

If something in this document contradicts what you find in the code, **the code is the
truth** — and tell the owner about the discrepancy.
