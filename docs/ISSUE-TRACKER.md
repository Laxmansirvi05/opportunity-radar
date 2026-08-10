# Issue Tracker — Opportunity Radar

Living record of every issue found in the 10 Aug 2026 audit and what has been done about it.
Source of findings: [`AUDIT-2026-08-10.md`](./AUDIT-2026-08-10.md) · AI features: [`AI-FEATURES-HANDOFF.md`](./AI-FEATURES-HANDOFF.md)

**Rules for this file**
- Nothing moves to ✅ **Fixed** without evidence — a command, a query result, or a test. Write the evidence down.
- "Should work now" is not evidence. If it was not verified, it stays 🟡 **In progress**.
- When a fix is deployed, record the date. Fixed-locally and fixed-in-production are different states.

**Status key:** ✅ Fixed · 🟡 In progress · ⬜ Open · ⏸️ Deferred (deliberate) · ❌ Won't fix

---

## Score card

| | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| **Fixed** | 4 | 7 | 0 | 0 | **11** |
| Open | 0 | 0 | 8 | 6 | 14 |
| Deferred | 0 | 0 | 1 | 1 | 2 |
| **Total** | **4** | **7** | **9** | **7** | **27** |

**No critical issues remain open.**

Last updated: **10 Aug 2026**

---

## ✅ Fixed

### DB-01 · Seven tables missing in production — **CRITICAL**
**Found:** `certifications`, `ai_search_jobs`, `resume_optimizations`, `resume_ats_reports` did not exist. Blocked AI Search, Certifications and Resume Optimisation entirely.
**Cause:** `20260626000000_resume_toolkit_v2.sql` applied only partially — `resumes` landed, the other three objects did not. Later migrations that `ALTER` those tables therefore could not run either.
**Fixed:** 10 Aug 2026. Applied in dependency order via `supabase db query --linked`:
1. `20260809120000_certifications.sql`
2. `20260809180000_ai_search_jobs.sql`
3. `20260810120000_repair_resume_toolkit_objects.sql` *(new — see DB-05)*
4. `20260810090000_resume_optimization.sql`

**Evidence** — `pg_class` after the change:
```
table                    rls    policies  service_role  authenticated
ai_search_jobs          true       3      true          true
certifications          true       1      true          true
resume_ats_reports      true       1      true          true
resume_optimizations    true       4      true          true
```
`resume_optimizations` has all 20 columns including `user_id`, `tier`, `suggestions`, `polished_resume`, `target_score`. A representative insert was accepted by the schema and rejected only by the `auth.users` foreign key, as expected.

> **Not applied deliberately:** a blanket `supabase db push` would replay migrations containing bulk `INSERT` data and duplicate the catalogue. Each migration was applied and verified individually instead.

---

### DB-02 · `service_role` had no GRANT on `notifications` — **CRITICAL**
**Found:** the nightly deadline-alert cron returned **500 every night**. `/api/cron/notifications` does `throw notifError`, and the service role could not read the table.
**Cause:** `GRANT … ON public.notifications TO service_role` appeared in **no migration**. Never granted, so never worked.
**Fixed:** 10 Aug 2026.
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles      TO service_role;
```
**Evidence** — the cron's exact two queries were replayed with the service-role key:
```
tracker query : OK — 0 rows due within 48h
notifications : OK — 0 existing DeadlineAlert rows
VERDICT       : cron would now succeed
```

---

### DB-03 · Storage bucket `resume-toolkit` did not exist — **CRITICAL**
**Found:** every resume-builder profile-photo upload returned 500. `app/api/resume/picture/route.ts:35` writes to a bucket that was never created.
**Fixed:** 10 Aug 2026, in `20260810120000_repair_resume_toolkit_objects.sql` — private bucket plus four owner-scoped policies on `storage.objects` matching the route's `<user_id>/pictures/<uuid>` path convention.
**Evidence:**
```
avatars           public=true
company-logos     public=true
report-evidence   public=false
resume-toolkit    public=false   ← new
resumes           public=false
```

---

### DB-04 · `certifications` table could not be created at all — **HIGH**
**Found while fixing DB-01.** The migration aborted with `42P17: generation expression is not immutable`.
**Cause:** the `fts` STORED generated column called `array_to_string(topics, ' ')`. A stored generated column requires an `IMMUTABLE` expression; `array_to_string` is only `STABLE`. The migration could never have succeeded anywhere.
**Fixed:** 10 Aug 2026. Removed `topics` from the `fts` expression and gave it a proper `GIN(topics)` index instead — the correct way to query an array. Verified no code reads `certifications.fts`: the page filters client-side over the fetched rows.

---

### DB-05 · `20260626000000_resume_toolkit_v2.sql` is unreplayable — **HIGH (structural)**
**Found:** its first statement is a bare `CREATE TABLE public.resumes` with no `IF NOT EXISTS`. Since `resumes` already exists, the statement fails and aborts the transaction before reaching the three objects that *are* missing. This is why DB-01 could never self-heal.
**Fixed:** 10 Aug 2026 by adding `20260810120000_repair_resume_toolkit_objects.sql`, which creates only the missing objects and is fully idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`) so it is safe in every environment.

---

### APP-01 · `/resume/copilot` was a hardcoded mockup reachable by students — **CRITICAL**
**Found:** the "68" ATS score, the donut chart offset, "Last saved 2m ago" and the gap list were all literals in `app/(protected)/resume/copilot/page.tsx`. None of it came from the student's resume. Reachable from `/resume` via `resume-list-client.tsx:81`.
**Fixed:** 10 Aug 2026, in three parts — unlinking alone was not enough, because the route stayed directly reachable and would still have shown a fabricated score to anyone with the URL.
1. Removed the live entry point in `resume-list-client.tsx` (the only reachable one — `/resume` renders this component).
2. **Replaced the mockup itself** with an honest under-construction page that says where the feature stands and points to ATS Check and the Resume Builder. The route is kept, because the real optimiser will be built there.
3. Deleted `workspace-tools-panel.tsx` — dead code (zero importers) carrying the same link.

**Evidence:** `grep -rn "resume/copilot"` across `app`, `features`, `components`, `lib` now returns only an explanatory comment — no link remains. Production build compiles `/resume/copilot`; 254/254 tests pass; TypeScript unchanged at the 36 baseline. The new page was rendered and visually confirmed via a temporary unprotected route, which was then deleted.

> Judgement worth recording: a fabricated ATS score is worse than no score, because a student may rewrite their resume in response to it. That is why the mockup was replaced rather than merely hidden.

---

### OPS-02 · Nothing detected schema drift — **HIGH (prevention)**
**Found:** DB-01 through DB-05 went unnoticed for weeks. A missing table only surfaces as a 500 on the single code path that touches it, and nobody was on those paths. There was no check that the deployed database matched the code.
**Fixed:** 10 Aug 2026. Added `lib/schema-guard.ts` — `verifySchema()` probes 24 required objects (18 tables, 4 storage buckets, 2 RPCs) and reports each as `ok` / `missing` / `denied` / `error`.

Two design points, both learned from this incident rather than assumed:

1. **Existence is not enough.** `notifications` existed the whole time — only the GRANT was absent. The guard probes *reachability as the role that uses the object*, so it separates `missing` (needs a migration) from `denied` (needs a GRANT). Collapsing those into "broken" would send someone to the wrong fix.
2. **`head: true` count queries cannot prove existence.** PostgREST returns `count: null` with **no error** for a table that does not exist. A head-count probe gave a false all-clear during the audit itself and had to be re-run. Every check now issues a real row select and reads the error code. This is pinned by a test.

**Wiring:** `instrumentation.ts` runs it in development only, fire-and-forget — Next.js awaits `register()` before serving requests, so probing 24 objects there would add that cost to every production cold start for nothing. Production gets the same check on `/api/cron/health`, which already runs daily; it now returns `status: "degraded"` and **HTTP 503** when drift is present, with a per-object failure list.

**Evidence:** 12 new tests, all passing. Mutation-tested — disabling the `42501` branch made exactly the two GRANT tests fail, so they detect real regressions rather than passing vacuously. Run against the live production database: **all 24 objects `ok`**, independently confirming the DB-01–DB-05 repair holds. Suite 266/266, TypeScript unchanged at 36, lint clean on all four touched files.

---

### APP-02 · Resume Optimisation — generation wired, PDF export, full UI — **the handoff prompt's stated next task**
**Found:** `lib/resume-optimizer/generate.ts` (Resume A/B generation, fabrication-guarded) existed with zero importers. No route, no PDF export, `/resume/copilot` was still the honest placeholder from APP-01.

**Built:** 10 Aug 2026, in the order the handoff prompt specified.
1. **`lib/resume-optimizer/run.ts`** — orchestrates a run: `extractJDIntelligence` → `evaluateResumeEvidence` → `calculateAtsV2Score` for the real baseline → `decideTier` → `deriveSuggestions` → `generatePolishedResume` where the tier calls for it, scored again with `calculateAtsV2Score` (never the model's own claim). A generated resume that cannot be scored is not shown — an unscored resume presented as scored would be exactly the fabrication this feature exists to avoid.
2. **`POST /api/resume/optimization`** (start a run, persists to `resume_optimizations`) · **`GET /api/resume/optimization`** and **`GET /api/resume/optimization/[id]`** (list/fetch — this is what makes a run survive logout) · **`PATCH /api/resume/optimization/[id]`** (checklist toggle; triggers Resume B generation once `targetResumeUnlocked()` flips true; **un-checking a suggestion after Resume B exists clears `target_resume`/`target_score`**, since it would otherwise keep presenting un-confirmed work as done).
3. **`lib/resume-optimizer/pdf.tsx`** — ATS-safe PDF via `@react-pdf/renderer`: single column, no colour, no tables, Helvetica (no font embedding needed). Deliberately not built on the vendored `packages/pdf` (Reactive Resume fork) to stay clear of the unresolved AGPL question in LEGAL-01.
4. **`features/resume-toolkit/components/optimizer/`** replaces the `/resume/copilot` placeholder: intake form (saved resume or upload, JD/role/company), baseline score always shown, tier message, suggestion checklist with progress bar, Resume A/B cards with the download gate, and a past-runs list. Re-linked from `resume-list-client.tsx` (unlinked there since APP-01).
5. Added `resume_polish` / `resume_target` to `RATE_LIMITS` (10/day each) — the handoff flagged these as declared `AIFeature`s with no limit, i.e. unlimited. (The remaining unlimited features were then closed by SEC-01, below.)

**Evidence:**
- 11 new tests (9 orchestration in `tests/resume-optimizer-run.test.ts` — mocking the AI-facing calls to assert the tier/warning/fabrication-safe branches independent of what the real scoring engine returns for a fixture resume; 2 PDF in `tests/resume-optimizer-pdf.test.ts` — **round-trips the actual generated PDF bytes through `pdf-parse`** and asserts the candidate's name, company, bullet text and skills come back as real extractable text, not an image). Suite: **277/277**.
- `npx tsc --noEmit`: **36 errors — unchanged baseline.** `npx eslint` clean on every touched file.
- `npm run build`: passes; all five new routes (`/api/resume/optimization`, `/api/resume/optimization/[id]`, `/api/resume/optimization/[id]/download`, plus the rebuilt `/resume/copilot` page) compile and register correctly.
- UI rendered and screenshotted via a temporary unprotected route (both the intake form and, with a fixture run, the results/checklist/lock view), then the route was deleted — same method APP-01 used, for the same reason: the five real accounts in `auth.users` are not mine to sign into.

**Not verified — say so plainly:** no end-to-end run against a real logged-in session or the live AI gateway/provider chain — that needs a real account, which I did not create or sign into. The owner should run one real optimisation end-to-end (per the "dual verification" rule — UX is the owner's call) before this is called done.

**Deployed:** committed `3aa4612` and pushed to `restore-june19` (the production branch). Not verified against the live deployment beyond confirming the site still responds correctly post-push (`/resume/copilot` → 307, `/api/cron/health` → 401, both matching pre-existing behaviour) — that is not the same as confirming the new routes work in production, which needs the same real-session run as above.

**Completeness pass, 10 Aug 2026 — two real gaps found and fixed on re-review, not just polish:**
1. **`polish_only` tier's checklist implied a Resume B that would never exist.** `tierPlan('polish_only')` correctly returns `generatesTarget: false` — no second resume for that tier — but `generatesSuggestions: true`, so the UI still rendered the interactive "confirm each item to unlock Resume B" checklist even though there was no Resume B section anywhere on the page to unlock. Worse, the **PATCH route had no tier check at all** — confirming a `polish_only` checklist would silently trigger a real `generateTargetResume` AI call for a resume the UI had nowhere to show or download. Fixed both sides: the PATCH route now gates target generation on `tierPlan(run.tier).generatesTarget`, and the UI renders `polish_only` suggestions as a plain informational list ("Worth strengthening" — no checkboxes, no progress bar, no gate language) instead of the interactive checklist, which is now shown only for the `full` tier where Resume B actually exists.
2. **A `full`-tier run with zero suggestions could never get Resume B.** `targetResumeUnlocked([])` is `true` by design (nothing to confirm) — but Resume B was only ever generated from the checklist's PATCH trigger, and the checklist UI doesn't render when `suggestions.length === 0`. So a resume that scored under 80 overall but happened to have every individual requirement already evidenced would sit "unlocked" forever with no way to actually produce the unlocked resume. Fixed in `startOptimizationRun()`: when the tier is `full` and there are zero suggestions, Resume B is now generated immediately at start time, same scoring discipline as everywhere else (`calculateAtsV2Score`, not shown if it can't be scored).

**Evidence:** 2 new tests in `tests/resume-optimizer-run.test.ts` (zero-suggestions auto-generates Resume B; pending suggestions do not). Suite: **296/296**. TypeScript unchanged at 36. Lint clean. Re-verified the UI fix visually via the same temporary-unprotected-route method, confirming a `polish_only` fixture run renders "Worth strengthening" with no Resume B section anywhere on the page — checked via `get_page_text`, not just a screenshot glance. Route deleted after.

**Full production verification pass, 10 Aug 2026, before calling this done:**
- **Schema:** every column the code reads/writes on `resume_optimizations` confirmed present in production with the expected type via `information_schema.columns` — no drift between code and deployed schema.
- **RLS:** confirmed enabled (`relrowsecurity = true`) with all four policies (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) present and each keyed on `auth.uid() = user_id`, read directly from `pg_policy`.
- **Routes live:** hit all five endpoints in production unauthenticated — `POST`/`GET /api/resume/optimization`, `GET`/`PATCH /api/resume/optimization/[id]`, `GET .../download` all return **401**; `/resume/copilot` returns **307** to login. Proves the deployment actually shipped and the auth boundary holds, not just that the build compiled.
- **Third bug found and fixed:** `resume_optimizations.original_resume_id` had `ON DELETE CASCADE` back to `resumes`, inherited from the original (pre-APP-02) migration. `deleteResume()` in `resume-actions.ts` performs a real hard `DELETE` on a saved resume — so a student picking "Saved Resume" to start a run, then later deleting that resume from `/resume`, would silently lose the **entire optimisation run**, including a completed, checklist-confirmed Resume B, even though `source_resume` is stored as its own JSONB snapshot specifically so the run doesn't depend on the original resume still existing (per that migration's own comment). Fixed with `supabase/migrations/20260810150000_fix_resume_optimizations_resume_fk.sql`: `ON DELETE SET NULL` instead. Applied directly to production and verified via `pg_constraint` (`confdeltype` changed from `c` to `n`). `user_id`'s own `ON DELETE CASCADE` was left alone — that one's correct, an account deletion should take its optimisation runs with it.
- **Schema guard:** re-ran `verifySchema()` against production after the constraint change — **all 24 objects still `ok`**.
- Full gate one more time: **296/296** tests, TypeScript unchanged at 36, production build clean.

**Route-handler test coverage added, 10 Aug 2026 — the largest remaining verification gap that didn't need a real session to close.** Everything up to here tested `lib/resume-optimizer/*` directly; none of the five Next.js route handlers themselves had ever been exercised — only traced by eye. That's exactly the layer where the `polish_only` and zero-suggestions bugs above were living, so eye-tracing had already proven insufficient once. Added `tests/api-resume-optimization.test.ts`, `tests/api-resume-optimization-id.test.ts`, `tests/api-resume-optimization-download.test.ts`, plus a shared `tests/helpers/fake-supabase.ts` (a minimal chainable fake of the Supabase query builder, so each test controls exactly what each table+operation returns without a real database). These call the actual exported `POST`/`GET`/`PATCH` functions with a real `NextRequest`, not a re-implementation of their logic.

**28 new tests**, covering per route:
- Auth boundary: every route 401s with no session, checked first, before touching validation or the database.
- Input validation: short JD, missing role/company, missing resumeId-or-resumeData, invalid `variant`.
- Ownership: `resumeId` lookups and run lookups are asserted to carry `.eq('user_id', user.id)` — not just RLS as the only line of defence, matching the project's existing "belt and suspenders" pattern elsewhere.
- The two bugs fixed above, re-proven at the HTTP layer: confirming a `polish_only` checklist (even fully unlocked) never calls `runTargetGeneration`; a `full`-tier confirmation does, and persists the result.
- Un-confirming a suggestion after Resume B exists clears `target_resume`/`target_score` in the actual persisted row.
- The download route streams **real PDF bytes** (not mocked — `renderResumePdf` runs for real) with the correct `Content-Type`/`Content-Disposition`, 404s the requested variant without silently substituting the other one, and a filename-sanitisation test using a `../../etc/passwd; rm -rf`-style resume name.
- Failure paths: orchestration failure → 502 without inserting a row; DB write failure after successful scoring → 500; list-query failure → 500.

**Evidence:** Suite: **324/324** (up from 296). TypeScript unchanged at 36. Lint clean on all 4 new files. Production build unaffected.

**What this does and doesn't close:** this proves the HTTP layer — auth, validation, the exact Supabase calls made, response shapes, and the tier-gating fixes — all wired correctly, using a fake database. It is not, and cannot be, a substitute for one real run through the real AI gateway with a real account — that remains the one thing only the owner can verify, per the project's own "dual verification" rule and the hard rule against signing into the five real `auth.users` accounts.

**4th bug — the one the owner actually hit, 10 Aug 2026: `/resume` (not `/resume/copilot`) had its own separate, pre-existing fake mockup.** The owner reported "the feature doesn't even open." All the verification above was against `/resume/copilot`, the route APP-01 fixed and APP-02 built out — but the main `/resume` landing page (`app/(protected)/resume/page.tsx`, last touched 24 Jul 2026, before this session and before the 10 Aug audit) had its own **completely independent** hardcoded "AI Resume Optimizer" panel sitting in the center column: a fixed **"68"** ATS score in a donut chart, three fabricated "Critical Gaps," a fake "Generated Result Preview," and two `<button>` elements — "Preview Full" and "Apply All AI Fixes" — with **no `onClick` handler at all**. The sidebar's "AI Optimizer" card was a plain `<div>` with a pointer cursor and no `href`. A student landing on `/resume` (the normal way in) would see what looks like a working feature with a real-looking score, click a button, and nothing would happen — exactly what was reported, and exactly the class of fabricated-data bug this whole project exists to eliminate. The 10 Aug audit never flagged this because it audited `/resume/copilot` specifically; this file was never in scope for APP-01 and I missed it too, despite multiple "thorough" review passes, because I was verifying the route I built rather than checking whether another entry point existed.

**Fixed:** 10 Aug 2026. Replaced the fake donut/gaps/preview panel with an honest card (no fabricated numbers, real copy explaining what the feature needs from the student) linking to the real `/resume/copilot`. Made the sidebar card a real `<Link href="/resume/copilot">`. Verified via the same temporary-unprotected-route method — screenshotted the new card, then clicked the real rendered link (not just checked the `href` attribute) and confirmed it navigated to `/resume/copilot`, which correctly redirected to `/login`. Route deleted after. TypeScript unchanged at 36, lint clean, 324/324 tests, build clean.

**Not yet checked:** the same page's right-column "Career Insights" panel (`+12% this month` resume strength, a fixed skills list, "342 active roles match your profile") is *also* entirely fabricated and untouched by this fix — it wasn't what was reported broken, and touching it wasn't requested, but it's the same class of problem sitting on the same page and is worth a follow-up.

**5th bug — the entry point opened, but analysis never completed, 10 Aug 2026.** With the 4th bug fixed, the owner reached the real `/resume/copilot` page, filled in the form, and submitted — and it never analysed. Root cause: **neither `POST /api/resume/optimization` nor `PATCH /api/resume/optimization/[id]` declared `maxDuration`.** A full run makes up to ~6 sequential AI-gateway calls (JD extraction, baseline evidence eval, polish generation with its own guarded retry, polish evidence eval, and conditionally a target generation + eval). `lib/ai-gateway/index.ts`'s own per-provider timeouts run up to 40s (Ollama) and the gateway falls back through several providers on failure, so a worst-case run legitimately takes well over a minute. Every other AI-heavy route already built this session (the two cron routes) explicitly sets `maxDuration = 300`, matching the pre-existing `refresh-employers` cron's own documented reasoning — these two routes were the ones that didn't get it, because they route through library orchestration (`startOptimizationRun`/`runTargetGeneration`) rather than an obviously-slow scrape loop, which is presumably why it wasn't obvious at build time that they needed it too.

**Fixed:** 10 Aug 2026. Added `export const maxDuration = 300` to both routes, with the reasoning written inline so it isn't lost again. Also updated the UI's loading toast to say "this can take up to a minute" rather than a bare "Scoring your resume...", since a legitimately-slow-but-working request should not read to a student as a frozen page. 324/324 tests, TypeScript unchanged at 36, lint clean, build clean.

**Not independently confirmed as the sole cause — say so plainly.** I don't have Vercel log access (not authenticated in this environment), so I could not read the actual error/timeout that occurred during the owner's real attempt. This fix addresses a real, structural gap that I'm confident was at minimum contributing, and matches the exact symptom reported (upload and form entry worked; submission produced nothing). If the owner tries again and it still doesn't analyse, the next diagnostic step is the browser Network tab's response for the `POST /api/resume/optimization` call, or the Vercel dashboard's function logs for that route.

**6th bug — the actual dominant cause, found by directly running the real pipeline against the owner's own resume and JD, 10 Aug 2026.** Ran `startOptimizationRun` directly (via `tsx`, real provider keys, no login needed) with the owner's exact resume content and job description. It completed correctly in 43.8s — proving the AI gateway and orchestration were never the problem. The real bug was upstream: **`resumes.parsed_data` is stored in the Resume Builder's shape (Reactive Resume's `ResumeData` — `basics.name`, `sections.experience.items[]`, HTML descriptions), not the flat `ParsedResume` shape the scoring engine reads (`name`, `skills[]`, `experience[]`).** Both `POST /api/resume/optimization` (for the "Saved Resume" path — the one the owner actually used, confirmed from their screenshot) and the pre-existing `/api/resume/ats-check` were casting `resumes.parsed_data` straight to `ParsedResume` with **zero conversion**. The AI was receiving an object with `name`/`skills`/`experience` all `undefined` — evidence evaluation correctly found nothing to evaluate, since there was genuinely nothing there. `ats-check`'s own `sample-frontend-dev` hardcoded fixture is in the correct flat shape — that's very likely the only path anyone ever actually exercised, which is why this went unnoticed.

The "Upload PDF" path had the same root problem for a different reason: `/api/resume/parse` (the Resume Builder's own extractor, which the optimiser's upload path reused) also returns `ResumeData` shape — and independently, that endpoint's extraction turned out to be unreliable regardless of shape. Traced directly: it asks the model to produce Reactive Resume's full schema (picture / metadata / layout / 12 section types) described only in prose — the schema itself is never actually shown to the model. A real extraction attempt on the owner's resume came back as `{"id": "..."}` and nothing else.

**Fixed:** 10 Aug 2026, three parts.
1. **`lib/resume-optimizer/convert-resume-data.ts`** — a real converter from the Builder's `ResumeData` shape to `ParsedResume`, handling HTML-to-text (turning `<li>` into separate bullets), splitting `"May 2026 - Aug 2026"`-style periods into start/end, classifying degree level from free text, and — deliberately — only setting a GPA when the source is unambiguously a 0-10 scale value (`"9.28/10"`); a percentage like `"94.2%"` is left out rather than converted, since that would be inventing a number. Wired into `POST /api/resume/optimization` for the `resumeId` path, with a guard (`looksLikeParsedResume`) so an already-flat resume is never double-converted.
2. **`lib/resume-optimizer/extract-resume.ts` + `POST /api/resume/optimization/extract`** — a new, dedicated extraction path for the optimiser's "Upload PDF" flow that targets `ParsedResume` directly instead of routing through the Builder's fragile schema. Deliberately not a fix to `/api/resume/parse` itself — that endpoint is shared by the Resume Builder and `ats-check`, and rewriting its prompt risked breaking those without being able to verify either live. The frontend now calls the new endpoint instead.
3. **Two schema bugs found via the real extraction, both silently failing the entire resume over one field:** `ResumeProjectSchema.technologies` had no default, so a model correctly omitting it for a project with no separately-listed tech stack failed validation for the *whole resume* — given `.default([])`. And a model instructed to omit an unavailable GPA was instead writing `gpa: 0` (a false claim, not "unknown") — now stripped in `extractResumeFromText`.
4. **Added `certifications`/`achievements` to `ParsedResumeSchema`** (`.optional()`, not `.default([])`, to avoid forcing every existing literal `ParsedResume` object across the codebase to add them) — the evidence evaluator had no clean signal to distinguish "certified in X" from "built a project in X" without them. Wired into both the new extractor's prompt and the Builder converter (pulling `sections.certifications`/`sections.awards`).

**Evidence:** ran the real pipeline end-to-end against the owner's actual resume PDF and actual job description (not a synthetic fixture) — PDF → real text extraction → new dedicated AI extraction → conversion → full `startOptimizationRun`. Final extraction captured all 5 certifications, all 4 achievements, all 6 experience bullets, all 4 projects, correct GPA (9.28, with no fabricated `0` for the two school levels that only had percentages) — verified by reading the actual JSON output, not just checking it didn't throw. 18 new tests (`resume-optimizer-convert-resume-data.test.ts`, `resume-optimizer-extract-resume.test.ts`) plus 2 existing tests fixed (they used `resumeData: {}` as a placeholder, which a new, correct validation now rejects — updated to a realistic fixture rather than loosening the check). Suite: **342/342**. TypeScript unchanged at 36. Lint clean.

**Also found, not fixed at the time — separate and pre-existing:** `ats-check`'s `resumeId` path has the exact same `parsed_data as any` cast bug. Out of scope here (touching that route risked breaking a feature I couldn't live-verify), logged for follow-up. **Fixed in APP-04** (below) once the ATS Checker itself was in scope. Native Gemini access is currently returning `403 Forbidden — "Your project has been denied access"` (not just the earlier `429` quota message) — worth checking the Google Cloud project's status directly; the gateway's fallback to OpenRouter/Groq/Cloudflare already covers this, as proven by every test above succeeding despite it.

---

### APP-03 · ATS scoring read as keyword matching, not recruiter judgment — **owner-requested, 10 Aug 2026**
**Found:** the owner gave concrete, worked examples of what the scoring engine should — and did not — distinguish: "certified in CSS" vs "built a project using CSS" vs "learned CSS" should not score the same; a virtual/simulated internship vs a real one should not score the same; a toy project (to-do list, calculator) vs a production-scale one (the owner's own "Opportunity Radar", or comparable system-design-level work) should not score the same. The scoring math (`lib/ats-checker/evidence-scoring.ts`) already had a `TYPE_BONUSES` table differentiating evidence types, but `certification` and `project` were tied at the same value (0.08), and — the larger gap — the evidence-evaluation prompt (`ats-v2-prompts.ts`) never instructed the model to judge a project's own complexity/scale at all, so two very different projects on the same technology could receive identical `evidenceStrength`. Separately, `gapReason` (the field that becomes the suggestion checklist's actual advice text — see `deriveSuggestions` in `tiers.ts`) is a valid, optional schema field the prompt's example output never showed populated, so it was very likely always empty, and every suggestion was silently falling back to `tiers.ts`'s generic templated sentence instead of real feedback.

**Fixed:** 10 Aug 2026.
1. Rewrote the evidence-evaluation system prompt with an explicit calibration hierarchy: bare skill listing < certification/coursework (capped at "moderate" — proof of studying, not building) < project (scaled by the project's own complexity — toy-scale caps at "moderate", production-shaped can reach "exceptional") < professional experience (scaled by how concrete and quantified the description is, not by the job title alone — a vague "virtual internship" caps at "moderate" the same as a toy project).
2. Widened `TYPE_BONUSES`: `certification` 0.08 → 0.05, `project` 0.08 → 0.09, so a certification can no longer numerically tie a real project on the same skill.
3. Made `gapReason` a required, worked-example field in the prompt's output schema whenever `satisfaction` isn't `"complete"`, with explicit instructions to write it the way a mentor would — specific and actionable, not a restatement of the requirement.
4. Added `certifications`/`achievements` to `ParsedResumeSchema` (see APP-02 above) specifically so this evaluator has a clean signal for "certified" that isn't inferred from a skill string.

**Evidence — a live, real AI proof, not just prompt text review.** Built one test resume with three parallel cases against a real JD: CSS backed only by a certification, HTML used only in a "Personal To-Do List" toy project, and PostgreSQL used in a production-shaped rebuild of the owner's own "Opportunity Radar" description (4,700+ records, multi-provider pipeline, deduplication engine). Ran the actual `evaluateResumeEvidence` → `calculateAtsV2Score` pipeline with real provider calls (Gemini was 403'd during this run; OpenRouter served it, proving the fallback path too):

| Case | satisfaction | evidenceStrength | score |
|---|---|---|---|
| CSS — certification only | partial | weak | **45** |
| HTML — toy project | partial | moderate | **59** |
| PostgreSQL — production-scale project | complete | exceptional | **100** |

Exactly the ordering requested: certification < toy project < production project. `gapReason` for the two unmet cases came back specific and actionable — e.g. *"A project showcasing more advanced CSS techniques (e.g., responsive layouts, animations, or component styling) would strengthen this area"* — not the old generic fallback. Also added 8 new deterministic unit tests for `scoreRequirement` (`tests/ats-evidence-scoring.test.ts` — no prior coverage existed for this function at all), pinning the certification-never-outscores-project invariant, the quantified-impact bonus, importance weighting, and satisfaction-level monotonicity, so this doesn't silently regress. Suite: **350/350**. TypeScript unchanged at 36. Lint clean.

**Not changed:** `lib/resume-optimizer/generate.ts`'s writing rules (banned AI-tell words, plain strong verbs) already covered the "professional voice / power words" request reasonably well on review — left alone rather than risk destabilizing an already-tested, working prompt.

---

### APP-04 · ATS Score Checker ran two competing scoring engines and persisted the wrong one — **owner-requested, 10 Aug 2026**
**Found:** a full audit of every ATS-scoring code path (owner-requested: "trace the complete flow... audit the existing codebase before changing code") turned up that `/api/resume/ats-check` ran the deterministic, evidence-based V2 engine (`extractJDIntelligence` → `evaluateResumeEvidence` → `calculateAtsV2Score`, the one `/resume/copilot` also uses) as its stated "PRIMARY" pipeline, but then — whenever V2 succeeded — unconditionally ran a **second, independent, keyword-matching engine** (`lib/ats-checker/job-match.ts` + a separate legacy JD-extraction prompt) in the same request, producing a second, different score for the same resume+JD. The client picked whichever score it found first for display, but the **database write always used the legacy engine's score, never V2's** (`score: jobMatchResult ? jobMatchResult.score : readiness.score` — `atsV2Data.score` was never referenced), so the stored `resume_ats_reports.score` could permanently disagree with what the student was shown on screen. A third, fully orphaned prompt (`services/ai/prompts.ts`'s `atsCheckSystemPrompt`) that literally asked the LLM to invent and return a `"score": 0-100` itself — the exact anti-pattern the owner explicitly ruled out — sat unused in the codebase with a matching dead schema vendored into `packages/schema/`, a landmine for a future accidental reconnect.

Separately, when the V2 pipeline itself failed (JD extraction or evidence evaluation), the route set one hardcoded banner text ("unable to extract meaningful requirements... after all fallback attempts") **regardless of which stage actually failed or why**, while still rendering a JD-independent "Readiness Metrics" card immediately below it with no framing — reading as if a complete analysis had happened next to a claim that it hadn't. And the Resume Optimiser's evidence prompt had exactly one few-shot example (a CSS-certification case); live testing showed the model pattern-copying that example's exact sentence structure across unrelated skills — "You've listed X as a skill, but nothing on your resume shows you've actually built something real with it," verbatim, for HTML then CSS then JavaScript then Bootstrap then React — which is what produced the near-identical "Build a project using X" checklist spam the owner reported.

A separate, previously-logged-but-deferred bug (`ats-check`'s `resumeId` path casting `resumes.parsed_data` — stored in the Resume Builder's nested `basics`/`sections.*.items[]` shape — directly to the flat `ParsedResume` shape every scoring function reads) was also still live: the exact bug already found and fixed in the Optimiser in APP-02, never applied here. The ATS Checker's "Upload PDF" path also still called `/api/resume/parse` (the Builder-shape extractor, already known unreliable for this purpose — see APP-02) instead of the dedicated flat extractor the Optimiser was switched to.

**Fixed:** 10 Aug 2026.
1. Deleted the entire legacy engine: `lib/ats-checker/job-match.ts`, the legacy JD-extraction prompt, the orphaned score-inventing prompt (`prompts.ts`) and its dead vendored schema duplicate (`packages/schema/src/resume/ats-check.ts`), and `jobMatchResultSchema`/`JobMatchResult`. One engine now: AI extracts structure and evidence, `calculateAtsV2Score` (pure TypeScript, zero AI involvement) computes the number.
2. Applied the APP-02 Builder-shape conversion (`convertResumeDataToParsedResume`/`looksLikeParsedResume`) to both the `resumeId` and upload paths, and switched the upload path to `/api/resume/optimization/extract` (the dedicated flat extractor), matching the Optimiser exactly.
3. Made the job description optional: `mode: 'resume_only'` (deterministic `calculateAtsReadiness`, no AI, no JD needed) vs `mode: 'targeted'` (the V2 engine), explicit in both the response schema and the UI — the owner's requirement that these be "two distinct, clearly-labeled modes," not one silently degrading into the other.
4. Replaced the boolean `aiFailed` with a structured `analysisError: { stage: 'jd_extraction' | 'evidence_evaluation' | 'unexpected', message }`, so the banner shows the AI gateway's actual returned reason instead of one hardcoded sentence regardless of cause. Readiness is still shown on failure, now explicitly labeled "does not depend on this job description" rather than sitting under the failure banner unexplained.
5. Extracted the gap → checklist deriver (`deriveSuggestions`) out of the Optimiser into `lib/ats-checker/gap-suggestions.ts`; both `/resume/ats` and `/resume/copilot` now call the identical function against the identical `StructuredJD`/`EvidenceMatrix`, so the two features can no longer disagree about what's missing for the same resume+JD.
6. Moved the CGPA/academic-standing rule out of the AI-coaching branch into a pure, directly-testable function (`lib/ats-checker/academic-recommendation.ts`) exposed as a top-level `academicRecommendation` field — mode-agnostic, no longer smuggled inside a coaching AI call's output.
7. Rewrote the qualitative coaching call (`buildAtsCoachingPrompt`) to take the already-final V2 result as input and produce narration only (`recruiterVerdict`, `powerWords`) — explicitly forbidden from recomputing or contradicting the score, evidence, or checklist, closing the "no competing logic between components" gap for the last AI surface in the pipeline. If this narration call fails, it is simply omitted — never replaced with fabricated fallback text standing in for something the AI didn't actually say.
8. Hardened both V2 prompts based on what the audit found: the JD-extraction prompt now explicitly instructs extracting *every* distinct requirement ("a typical real JD yields 8-20; extracting 1-2 almost always means you stopped too early") with explicit preferred-vs-required category guidance; the evidence prompt gained an explicit anti-templating rule plus a second, structurally different few-shot example, so the model reasons per-requirement instead of copying one example's phrasing.
9. Fixed the DB persistence bug directly: `resume_ats_reports.score` is now always `atsV2Data.score.overallScore` when targeted analysis succeeds (or `readiness.score` in resume-only mode) — never a second engine's number.
10. Added `export const maxDuration = 180` — this route had none at all despite making up to 3 sequential multi-provider AI calls, the same class of bug already found and fixed on `/api/resume/optimization` (silently killed by Vercel's default timeout mid-pipeline).

**Evidence — live, real AI proof, not just prompt text review.** Ran the actual `extractJDIntelligence` → `evaluateResumeEvidence` → `calculateAtsV2Score` → `deriveSuggestions` pipeline via `tsx` against real provider calls (OpenRouter/Groq served it; native Gemini is still 403'd, as previously logged):
- **JD-extraction breadth regression caught live, then fixed live:** the first run against a real, 19-line JD extracted **1 requirement**, reproducing the exact "no meaningful requirements" failure mode from the bug report even though the JD plainly listed a dozen. Root cause: `extractJDIntelligence`'s validator only rejected *zero* requirements, so a technically-non-empty but badly under-extracted response passed validation and never retried across the provider chain. Added a length-proportional minimum requirement count to the validator (`lib/ats-checker/ats-v2-intelligence.ts` — 3 for a >300-char JD, 5 for >900 chars) forcing retry on under-extraction. Re-ran against the same JD: **19 requirements** extracted, correctly split into `technical_capability`/`responsibility`/`education`/`location_auth`/`preferred_qualification` categories (4 correctly identified as preferred-only: TypeScript, Docker, Kubernetes, prior internship).
- **Anti-templating fix confirmed live:** evaluated a skills-only-no-evidence resume against those 19 requirements — 16 gap reasons came back with 16 distinct openings (previously the exact bug: near-identical phrasing across every skill), each citing the resume's own specifics (e.g. *"While your portfolio shows basic UI creation, this role requires..."* vs *"This role requires the ability to integrate REST APIs, but your resume doesn't show any experience with this."*).
- **Evidence-based discrimination confirmed live, same JD, two resumes:** a skills-only-no-evidence resume scored **34 (poor)**; a resume with a genuine production-shaped project and real experience bullets against the identical JD scored **70 (moderate)** — a 36-point spread from evidence quality alone, with only Docker/Kubernetes (genuinely absent) left as gaps for the strong resume vs. 6 gaps for the weak one.
- **Malformed JD failure confirmed clean:** fed 180 characters of non-JD noise text — failed across all 6 configured providers (the validator correctly rejecting each attempt), returned `success: false` with the real reason, no fabricated score at any point.
- **Academic recommendation confirmed:** correctly triggered for a 7.1 GPA in-progress B.Tech resume, correctly returned `null` for an 8.4 GPA one on the identical rule.
- Both `/resume/ats` UI states (targeted success, targeted failure, resume-only) and the intake form (JD-optional, dynamic Target Role/Company enabling, dynamic button text) were screenshot-verified via a temporary unprotected route, then deleted.
- 5 tests updated for the new contract (CGPA assertions moved to `academicRecommendation`, failure-mode tests now assert the real `analysisError.stage`/`message`), 2 legacy-only test files deleted (`ats-scoring-audit.test.ts`, `ats-scoring-v2.test.ts`), 5 new tests added (resume-only mode never touches the V2 pipeline, DB-persisted score matches the response exactly, JD-extraction-prompt content). Suite: **342/342** (350 baseline − 11 legacy-only tests deleted with their engine + 3 new). TypeScript unchanged at 36. Lint: error count on touched files actually *dropped* (24→9) from deleting legacy code; remaining `any` casts match the codebase's existing Supabase-JSONB convention. Production build passes, `/resume/ats` and `/resume/copilot` both present as dynamic routes.

---

### APP-05 · Hub — global community chat built out and fixed — **owner-requested, 11 Aug 2026**
**Found:** substantial WIP Hub code already existed uncommitted (messages table + RLS, send/list/delete API routes, a realtime hook, message/profile/reply components) — functionally close to complete, but with real, concrete bugs and gaps:
- `hub/page.tsx` redirected unauthenticated users to `/auth/login`, a route that does not exist (every other protected page in the app uses `/login`) — would 404 instead of reaching sign-in.
- The `hub_messages` table's RLS only had SELECT/INSERT/DELETE policies; the grants migration granted UPDATE at the table level but no row-level policy ever permitted it, so editing (once built) would have silently failed under RLS regardless of the application code.
- `hub-profile-modal.tsx` used `max-w-md`, hitting the same Tailwind theme-collision bug already found and worked around once this session (UI-03: `--spacing-md` in `globals.css` silently resolves `max-w-md` to 16px) — the profile card was rendering as an unreadable 16px-wide sliver.
- `HubProfileModal`'s `getPublicProfile()` call had no error handling — a thrown error (RLS denial, transient DB error) became an unhandled promise rejection and left the modal stuck on "Loading profile..." forever, since `setIsLoading(false)` was never reached.
- The message action menu (Reply/Edit/Delete) was hover-only (`group-hover`), which never triggers on a touch device — on a chat feature, where mobile is the primary way anyone uses it, those actions were simply unreachable there.
- `hub-message.tsx` called `toLocaleTimeString()` directly during render (including SSR) — timezone/locale differ between the server and the viewer's browser, causing a real, reproducible hydration mismatch on every single message.
- A `next/image fill` image bubble used `w-full` inside a flex-col ancestor with no definite width of its own; since `fill` makes the `<img>` absolutely positioned (contributing zero intrinsic size to its parent), the whole image bubble collapsed to a single-digit-pixel dot.

**Built/fixed:** 11 Aug 2026.
1. Fixed the `/auth/login` → `/login` redirect bug, and moved `/hub` from the `(protected)` layout group (dashboard sidebar + header squeezing the chat into a narrow column) to `(protected-fullscreen)` (the same group Resume Builder uses) — a chat needs the full viewport, not a sidebar-constrained panel. Added a back-to-dashboard link into the Hub's own header to replace the navigation chrome that move removes.
2. Migration `20260811120000_hub_images_and_edit.sql`: added `image_url`/`image_width`/`image_height`/`edited_at` columns, relaxed the content check constraint to allow image-only messages, added the missing `hub_messages_update` RLS policy, and created the public `hub-attachments` storage bucket (same per-user-folder-ownership policy pattern as `avatars`). Applied directly to the linked production database via `supabase db query`, verified live (columns, policy, bucket all confirmed present via direct query).
3. New features beyond the original WIP, per the owner's explicit ask for "maximum number of features" on a WhatsApp-style chat: image sending (`POST /api/hub/upload`, with a client-side image picker + caption + upload progress state), message editing (`PATCH /api/hub/messages/[id]`, RLS-enforced to the sender, cannot edit a text-only message down to empty), a full-screen image lightbox with download, and a Supabase Presence-backed "N online" indicator in the header.
4. Fixed all bugs found above: `/login` redirect, the missing UPDATE RLS policy, the `max-w-md` collision (same inline-style workaround as before, now logged as a second occurrence of UI-03), the unhandled-rejection/stuck-loading bug in the profile modal (wrapped in try/catch, falls back to the basic sender info already on hand), the hover-only action menu (now also tap-to-toggle with click-outside-to-dismiss, repositioned above the bubble rather than to its side so it can't clip off a narrow phone screen), the timestamp hydration mismatch (deferred to a client-only effect, matching the established `typeof window` convention already used elsewhere in this codebase for the same class of problem), and the collapsed image bubble (fixed pixel width instead of a percentage one).
5. Full visual redesign pass across the header, message bubbles, input bar, and profile modal for a cleaner, denser, more professional feel, addressing the owner's explicit "the UI is not at all good" complaint.
6. **Found via the owner's own live test, after initial ship — every sender showed as "Student" with a generic avatar, and the profile modal looked incomplete.** Root cause: `profiles` SELECT RLS is `auth.uid() = id` — a user can only read their *own* row through the regular Supabase client. Two of the four sender-resolution code paths used the regular (RLS-bound) client to look up *other* users' profiles for a public chat where every member's name/avatar must be visible to everyone: `hub/page.tsx`'s SSR fetch (both the main sender loop and the reply-preview lookup), and `use-hub-messages.ts`'s realtime handler (client-side, so it could never legitimately use the service-role key directly). Confirmed live against production: a direct query returned the correct `name`/`avatar_url`/`bio`/`skills`/etc. for the real accounts involved, proving the data was always fine and the bug was purely in which client fetched it. Fixed by switching the SSR page to the service-role client (matching the pattern the API routes already used correctly) and adding a new `GET /api/hub/senders?ids=...` route so the realtime path can resolve other members' public info through an authenticated server endpoint instead of either being blocked by RLS or holding the service-role key in the browser. Re-verified live: the new route correctly resolves both real test accounts' full profile data (name, avatar URL, LinkedIn) against the production database.

**Evidence:** every interactive path — text send, image send with caption, reply, reply-preview-click-to-scroll, edit (save/cancel), delete, profile modal (including the graceful fallback when the deeper profile fetch fails), image lightbox open/close, tap-to-reveal action menu, mobile viewport (375px), and the resume-only readiness path — was exercised via a temporary unprotected preview route with realistic fixture data (text, image, reply, edited, own vs. other, consecutive-message grouping, failed/optimistic states), inspected via direct DOM/computed-style assertions (not just screenshots — several of the bugs above, including the collapsed image, the squished modal, and the stuck-loading profile, were only conclusively confirmed this way), then the route was deleted. The sender-resolution fix (item 6) was additionally verified with a live integration test calling the real `/api/hub/senders` route against the actual production database and real account data, then deleted. 342/342 tests (2 pre-existing `schema-guard.test.ts` fixtures updated for the new `hub-attachments` bucket entry). TypeScript unchanged at 36 baseline (some untracked root-level `test-hub-*.ts` debug scripts from the prior WIP session have pre-existing errors of their own — left untouched, not part of this change). Lint clean on every touched/new file. Production build passes with all five Hub API routes present (`messages`, `messages/[id]`, `send`, `upload`, `senders`).

**Not done — flagged, not fixed:** the app's dark mode (`.dark` class-based, `--color-surface` etc. redefined inside a `.dark {}` block in `globals.css`) did not visibly re-theme when tested — same pre-existing, wider app-level theming gap already noted once earlier this session on the Resume Optimiser pages, not something introduced or worsened here, and out of scope for a single feature's UI pass.

---

### SEC-01 · AI rate limiting covered 4 of 17 features — **HIGH**
**Found:** `RATE_LIMITS` in `lib/ai-gateway/index.ts` defined only `resume_parser`, `resume_ats`, `resume_optimizer`, `skill_extraction` (plus `resume_polish`/`resume_target` added in APP-02). `checkRateLimit` did `if (!limit) return true`, so every other declared `AIFeature` — `jd_intelligence`, `evidence_evaluation`, `resume_ats_v2_*`, `hr_coaching`, `assistant`, `schema_repair`, `resume_extraction`, `resume_optimization`, `resume_ats_jd_extract`, `resume_ats_coaching`, `resume_ats_general_coaching` — was completely unlimited. An authenticated user could drain the provider quota through any of them.
**Fixed:** 10 Aug 2026. Added a `DEFAULT_LIMIT` (30/hour) fallback in `checkRateLimit`, applied to any feature without its own entry, replacing the `return true`. Per-feature tuned limits should still be added as real usage patterns become known — this is a backstop, not a claim that 30/hour is the right number for every feature (e.g. `assistant` chat likely wants its own, higher limit).
**Evidence:** new test `tests/ai-gateway-rate-limit-default.test.ts` — mocks the provider chain and the Supabase RPC backstop, then calls `callAI` with `feature: 'assistant'` (a real, previously-unlimited `AIFeature`) 30 times successfully and asserts the 31st fails with `reason: 'rate_limit'`; a second test confirms anonymous (no `userId`) calls remain unthrottled by design. Suite: **279/279**. TypeScript unchanged at 36. Lint clean on both touched files — the 2 pre-existing `no-explicit-any` errors in `lib/ai-gateway/index.ts` are unrelated lines untouched by this change (confirmed via `git stash` diff before/after).

---

### DATA-01 · 376 listings link to a search page, not the job — **the audit's number was wrong; 170 actually needed fixing**
**Found:** the original audit flagged 376 rows by URL *pattern* (`/search`, `/open-positions`, `/careers-list` in the URL) as dead-end links, without clicking through per company.

**Re-investigated:** 10 Aug 2026, with the owner present. Clicked through real sample URLs (2–3 per company, in a live browser, JS executed) for every company on the list, not just the URL shape:

| Company | Rows | Result |
|---|---|---|
| Stripe | 126 | **Broken** — every sample landed on an unfiltered 549-job list; the `gh_jid` query param is not consumed client-side |
| HighRadius | 44 | **Broken** — every sample landed on the marketing homepage, not even a job list |
| Databricks | 125 | **Works** — every sample deep-linked to the correct job title and description |
| MongoDB | 52 | **Works** — same |
| Fivetran | 29 | **Works** — same |

Only **170** of the 376 (Stripe + HighRadius) were real dead-ends. The other 206 were a false positive from the pattern-matching heuristic — their embedded Greenhouse widgets do correctly resolve `gh_jid` client-side, the URL shape just looked generic.

For the 170 real dead-ends, checked whether the audit's suggested fix (`https://job-boards.greenhouse.io/<slug>/jobs/<id>`) provides a working alternative: it does not — for both Stripe and HighRadius, every Greenhouse-hosted-domain variant (`job-boards.greenhouse.io` and `boards.greenhouse.io`) 301-redirects to the same broken company page. Both companies have fully migrated to a custom-domain embed with no working per-job deep link anywhere. There is no honest URL to reconstruct.

**Fixed:** 10 Aug 2026.
```sql
UPDATE opportunities SET status = 'Expired', updated_at = NOW()
WHERE company_name IN ('Stripe', 'HighRadius') AND status = 'Published';
```
This is a data-only change — no schema modification, so the full schema guard wasn't the relevant check. `opportunity-service.ts` and the `search_opportunities_rpc` fast path both filter `status IN ('Published', 'Closing Soon')`, so `Expired` rows are excluded from every search path a student can reach.

**Evidence:** dry-run `SELECT ... GROUP BY company_name, status` before the update showed exactly 170 rows, all `Published`. Re-ran the same query after the `UPDATE` with a real row-select (not `head:true`) — confirmed **170/170 now `Expired`**, split 126 Stripe / 44 HighRadius as expected. Databricks/MongoDB/Fivetran rows were not touched.

---

### DATA-02 · Internshala is 73% dead — **audit's number held up under re-verification**
**Found:** the audit reported 27 of 37 Internshala listings rendering *"Applications are closed for this internship."*

**Re-verified:** 10 Aug 2026. Pulled all 32 `Published` Internshala rows (5 of the 37 were already `Expired`) and fetched each `apply_url` directly (not head:true, not a pattern match — the literal marker text) with a real browser user agent. **22 of 32 showed the closed banner; 10 were genuinely open.** 22 + the 5 already-Expired = 27 — matches the audit exactly. Spot-checked one closed and one open result in an actual browser (not just curl) to rule out a client-side-rendered banner producing a false negative: both matched the curl-based read.

**Root cause:** Internshala returns HTTP 200 with the closed banner embedded in the page rather than 404ing — nothing in the ingestion pipeline ever read the page to notice, so a closed posting kept getting re-confirmed as live (`last_seen_at` refreshed) on every run indefinitely.

**Fixed:** 10 Aug 2026, two parts.
1. **Data:** `UPDATE opportunities SET status = 'Expired', updated_at = NOW() WHERE id IN (the 22 confirmed IDs) AND status = 'Published'`. Verified before (22/22 `Published`) and after (27 `Expired` / 10 `Published` for the full Internshala set, matching 5 already-expired + 22 newly-expired) with real row-selects.
2. **Scraper:** added `src/providers/opportunities/utils/internshalaClosedDetector.ts` (`isInternshipClosed()`), wired into both `InternshalaProvider.fetchDetailPage()` (throws, so the queue-consumer path marks it failed rather than upserting it) and the detail-enrichment loop inside `fetch()` (the path actually running in production via `/api/cron/refresh-internshala` — excludes closed items from the batch entirely, so they stop being refreshed as live and fall through to the existing reconciliation gate instead).

**Evidence:** new tests — `tests/internshala-closed-detector.test.ts` (4 cases: real captured banner text, case-insensitivity, an open posting, and a false-positive guard against unrelated "closed" mentions) and `tests/internshala-provider-closed.test.ts` (`fetchDetailPage` rejects a closed posting, returns normally for an open one, mocking `fetch` directly). The `fetch()` end-to-end path itself isn't separately tested — its list-scraping logic loops over 18 category URLs × pagination and mocking that fully wasn't worth the cost — but the detection logic both paths call is fully unit-tested and the wiring at each call site is a small, reviewed diff. Suite: **285/285**. TypeScript unchanged at 36. Lint: the 9 errors/6 warnings in `InternshalaProvider.ts` are pre-existing (confirmed via `git stash` diff, same 15 problems before and after); the new files are clean.

---

### DATA-03 · Link verification never ran — **scoped deliberately narrower than "detect any dead link"**
**Found:** `link_status`/`link_checked_at` have existed since the trust-engine migration; nothing ever populated them — `NULL` on all 4,175 live rows.

**Scope decision, made explicit because DATA-01 is a cautionary tale here:** DATA-01 showed that HTTP status code alone can't tell a real per-job page from a broken one — Stripe and Databricks both return 200 for their `?gh_jid=` URLs, and only reading the rendered content told them apart. A status-code sweep can't replicate that per-company judgement call at 4,000-row scale. So this sweep does exactly what its name says — verifies the HTTP-level outcome — and only auto-expires the subset where that's unambiguous regardless of page content: the URL doesn't resolve at all (DNS/connect failure), or the host itself says the resource is gone (404/410). A 403/401/405/5xx is recorded but left alone, because the original audit's own Amazon false-positive (a "404 error" string inside analytics JS) is exactly the failure mode of trusting an ambiguous signal.

**Built:** 10 Aug 2026.
- `lib/ingestion/link-checker.ts` — `checkUrl()` (HEAD, falling back to GET on 405/501 or a thrown error; resolves to `status: 0` rather than throwing, so one bad host never stalls a batch) and `sweepLinkHealth()` (selects live rows ordered `link_checked_at NULLS FIRST`, checks at bounded concurrency within a time budget, writes `link_status`/`link_checked_at` for every row checked, and auto-expires only the unambiguously-dead ones).
- `app/api/cron/link-sweep/route.ts` — same fail-closed `denyIfNotCron` pattern as every other cron, `maxDuration = 300`, a 270s internal time budget so the function always returns before Vercel's own ceiling. Scheduled nightly at `0 2 * * *` in `vercel.json`, after the other ingestion crons.
- Resumable by construction: a time-budget cutoff mid-sweep is safe — everything checked so far is already written, and the next run picks up the least-recently-checked rows first.

**Evidence:**
- 9 new tests in `tests/link-checker.test.ts`: `classifyLinkStatus` (0/404/410 dead, 403/401/500/301 not), `checkUrl`'s HEAD→GET fallback on both a 405 and a thrown error, and `sweepLinkHealth` against a fake Supabase-shaped `Db` — confirms per-row `link_status` writes, that only the 404 in a 3-row mixed batch gets expired (403 does not), and that the time-budget cutoff actually stops the loop rather than overrunning. Suite: **294/294**. TypeScript unchanged at 36. Lint clean.
- **Live proof-run against production**, not just mocks: ran `sweepLinkHealth` directly (via `tsx`, real service-role client, `limit: 12`) against the actual database. Result: `{ checked: 12, ok: 12, dead: 0, expired: 0 }`. Verified independently with a real row-select (not `head:true`) — `SELECT count(*) WHERE link_checked_at IS NOT NULL` → **12**, all `link_status = 200`. The scratch script was not committed.
- The full nightly sweep has not yet run in production — it starts at `0 2 * * *` once this deploys. The 12-row proof-run above confirms the mechanism works end-to-end; it does not confirm throughput at the full ~4,000-row scale within the 300s ceiling. Worth checking after the first scheduled run.

---

## ⬜ Open — Critical

*(none)*

---

## ⬜ Open — High

*(none)*

---

## ⬜ Open — Moderate

| ID | Issue | Where |
|---|---|---|
| UI-01 | Headline renders `"Your next opportunityis already out there."` on every viewport under 1024px — the hidden `<br>` is the only whitespace | `features/auth/components/auth-experience.tsx:95` |
| UI-02 | Login form sits below the fold (form top 1096px vs 987px viewport) — users must scroll to log in | same file |
| DATA-04 | 416 duplicate rows across 12 URL groups, plus 6 genuine title+company duplicates (all Amazon) | `opportunities` |
| DATA-05 | 160 listings have a past deadline; 144 still `Published`. Search hides them, but every count is inflated | `opportunities` |
| DATA-06 | 105 listings (2.5%) have no description — SmartRecruiters 95, Lever 10 | `opportunities` |
| DATA-07 | `trust_tier` is `3` on all 4,175 rows — the trust engine does not discriminate. Only 5 rows `verified=true` | `opportunities` |
| CODE-01 | 36 TypeScript errors shipped unchecked behind `typescript.ignoreBuildErrors: true` | `next.config.ts` |
| CODE-02 | 6 test files import `@testing-library/react`, which is not installed — **those tests never run** | `features/**/*.test.tsx` |
| SEC-02 | CSP allows `'unsafe-eval'` and `'unsafe-inline'` for scripts, defeating most of its XSS value | `next.config.ts` |
| UI-03 | Custom `--spacing-sm`/`--spacing-md`/`--spacing-xl` tokens in `@theme inline` (`app/globals.css:241-244`, added for `p-md`/`gap-md`-style utilities) silently collide with and override Tailwind v4's built-in container-width scale — `max-w-sm`/`max-w-md`/`max-w-xl` resolve to `8px`/`16px`/`40px` instead of `24rem`/`28rem`/`36rem` project-wide, even though `--container-md` etc. are separately and correctly defined. Found while redesigning the Resume Optimiser results page (a `max-w-md` on a description `<p>` was collapsing to one-word-per-line); worked around locally with an inline `style={{ maxWidth }}` rather than fixed at the token level, since renaming/scoping the custom tokens needs a sweep of every component using `max-w-{sm,md,xl}` across the app to confirm nothing was relying on the broken value. Likely affects other pre-existing UI using those three classes. | `app/globals.css:241-244` |

---

## ⬜ Open — Low

| ID | Issue |
|---|---|
| CLEAN-01 | ~500 MB of build artifacts, logs and debug screenshots committed (audit §7.1) |
| CLEAN-02 | 19 superseded documents (audit §7.3) |
| CLEAN-03 | ~30 verified-dead code modules (audit §7.4) |
| CLEAN-04 | 4 `opportunities_backup*` tables holding 5,158 rows total |
| CLEAN-05 | `/resume/test-engine` and `/test-ats` — dev pages routable in production |
| SEC-03 | Dead `login-form.tsx` / `signup-form.tsx` read `?next=` with no validation. Not imported, so not live — delete before anyone wires them up |
| CODE-03 | `/api/opportunities/recommended` returns 500 unconditionally (`get_ranked_opportunities` RPC missing) and has **zero callers** |

---

## ⏸️ Deferred

### LEGAL-01 · Reactive Resume licensing — **needs your decision, not a code change**
`features/resume/` and 197 other files import `@reactive-resume/*`, vendored into `frontend/packages/`. The fork at `/Users/laxmansirvi/reactive-resume` is relabelled `"resumeai"` / MIT, but upstream Reactive Resume is **AGPL-3.0** from v4. Relabelling does not change the licence, and AGPL requires offering source to users of a network-deployed service.
**Action:** confirm which upstream version and licence the fork came from before any public launch.

### OPS-01 · Queue consumer not running in production
`ingestion_queue` holds **186 pending** items. The consumer only runs via `npm run cron:consume`. Deliberate for now — the direct provider path is carrying ingestion successfully (98.7% freshness).

---

## Feature completion

| Feature | Before 10 Aug | Now | Note |
|---|---|---|---|
| Hub | 0% | **90%** | Full realtime group chat: text, images, replies, editing, delete-own, per-user clear-chat, profile view, online presence (APP-05). Same owner-login caveat as the resume features; dark mode re-theming gap (pre-existing, app-wide) not addressed |
| Search | 85% | 85% | |
| Tracker | 90% | 90% | |
| Resume: builder | 80% | **85%** | Photo upload unblocked (DB-03) |
| Resume: extract | 75% | 75% | |
| Resume: ATS | 85% | **95%** | Consolidated onto the single deterministic V2 engine (deleted the competing keyword engine), fixed the DB-score persistence bug, fixed the Builder-shape extraction bug (APP-02's class, now also here), added resume-only mode, real-provider-verified JD-extraction and anti-templating fixes (APP-04). Same owner-login caveat as optimisation below |
| Resume: optimisation | 35% | **98%** | Generation, PDF export, full UI, 3 real bugs found and fixed, schema/RLS/routes verified live in production, all 5 route handlers directly tested against a fake DB — 28 tests (APP-02); now also shares its gap-checklist deriver and evidence-prompt quality fixes with the ATS Checker (APP-04). The irreducible last piece: nobody has run it with a real login yet, and only the owner can do that |
| AI Search | 35% | **50%** | DB blocker cleared; agent still undeployed |
| Certifications | 30% | **45%** | Table exists; no ingest pipeline yet |
| AI Voice Interview | 2% | 2% | |
| Auth | 90% | 90% | |
| Profile / Settings / Notifications | 85% | **90%** | Nightly cron fixed (DB-02) |
| **Overall** | **~58%** | **~75%** | |

---

## Next up

1. **Owner UX pass on Resume Optimisation** — run one real optimisation end-to-end (real login, real JD, real AI gateway) and confirm the checklist gate, both downloads, and persistence-after-logout feel right. Per the "dual verification" rule this is the owner's call, not something further code review can substitute for.
2. **`/resume`'s "Career Insights" panel is still fabricated** — `+12% this month`, a fixed skills list, "342 active roles match your profile," none of it real. Same class of bug as the AI Optimizer panel just fixed, on the same page, not yet touched.
3. **Check the first scheduled `link-sweep` run** (`0 2 * * *`) once it lands — the 12-row proof-run confirmed correctness, not full-catalogue throughput within the 300s ceiling.
4. **Deploy the AI Search agent** (see the handoff document)
5. Everything else in **Open — Moderate** and **Open — Low** below — no High or Critical issues remain open.

---

## Log

| Date | Change |
|---|---|
| 10 Aug 2026 | Full audit; 25 issues catalogued |
| 10 Aug 2026 | DB-01 – DB-05 fixed and verified; database drift resolved |
| 10 Aug 2026 | OPS-02 fixed — schema guard added; verified green against production (24/24 objects) |
| 10 Aug 2026 | APP-01 fixed — copilot mockup unlinked and replaced with an honest placeholder; dead `workspace-tools-panel.tsx` deleted. **No critical issues remain open.** |
| 10 Aug 2026 | APP-02 built — Resume Optimisation generation wired, ATS-safe PDF export, full UI replacing the APP-01 placeholder. 277/277 tests, TypeScript unchanged at 36, build passes, UI screenshot-verified via a temporary unprotected route (then deleted). Not yet run end-to-end against a real session. |
| 10 Aug 2026 | Committed `f28e6c4` and deployed to production from `restore-june19` (the production branch). Deployment `opportunity-radar-h5741titk` Ready. Post-deploy check: `/` and `/login` return 200; `/search`, `/tracker`, `/resume`, `/certifications`, `/ai-search` all 307 to `/login?next=…` with the destination preserved. |
| 10 Aug 2026 | Committed `3aa4612` (APP-02) and pushed to `restore-june19`. Post-push spot check only: `/resume/copilot` → 307, `/api/cron/health` → 401, matching pre-existing behaviour — **not** a confirmation the new feature works live, since that needs a real session. |
| 10 Aug 2026 | SEC-01 fixed and pushed (commit `86eef58`) — default rate limit (30/hour) closes the unlimited-feature gap for every `AIFeature` without a tuned entry. 279/279 tests. |
| 10 Aug 2026 | DATA-01 re-investigated with the owner present: only 170 of the audit's 376 rows were real dead-ends (Stripe 126, HighRadius 44) — the other 206 (Databricks, MongoDB, Fivetran) were a false positive from URL-pattern matching; verified by clicking through live samples per company. No working link exists for the 170, including the audit's suggested `job-boards.greenhouse.io` fallback. Expired all 170 in production; verified via real row-select before and after. |
| 10 Aug 2026 | DATA-02 re-verified and fixed: 22 of 32 published Internshala rows genuinely show the closed banner (curl + browser spot-check), matching the audit's 27-total once the 5 already-expired are added back. Expired the 22 in production. Taught `InternshalaProvider` the closed-page marker at both call sites so it stops re-confirming closed postings as live. 285/285 tests, TypeScript unchanged at 36. |
| 10 Aug 2026 | DATA-03 built and shipped: `lib/ingestion/link-checker.ts` + `/api/cron/link-sweep`, scheduled nightly at `0 2 * * *`. Scope deliberately narrower than "detect any dead link" — only DNS/connect failure, 404 and 410 auto-expire; everything else is recorded, not acted on, per the DATA-01 lesson that status codes alone can't tell a real page from a broken one. 294/294 tests. Live proof-run against production (12 rows, real service-role client) verified with a real row-select, not just mocks. **No High or Critical issues remain open.** |
| 10 Aug 2026 | Resume Optimiser UI redesigned, owner-requested ("not consuming high white space... more professional, more interactive"). Results page: score rendered as an SVG ring in one unified header card instead of two stacked cards; Resume A/Resume B moved from full-width stacked cards to a side-by-side grid with inline scores and download buttons; suggestion checklist tightened (compact rows, progress fraction + bar) and made genuinely interactive (click to toggle, disabled while pending). Intake form: resume-source toggle changed from two loose buttons to a single segmented control, upload dropzone and "Past runs" list tightened. Found and worked around UI-03 (Tailwind theme-collision bug, logged above) during this pass. Screenshot-verified both pages via temporary unprotected routes (`dev-preview-optimizer`, `dev-preview-optimizer-form`), both deleted after. TypeScript unchanged at 36, lint clean on touched files. |
| 10 Aug 2026 | APP-04 fixed: full audit + rewrite of the ATS scoring pipeline, owner-requested ("evidence based ATS score... not word matching... trace and correct the complete underlying pipeline"). Deleted the entire legacy keyword-matching engine that was running alongside the real V2 engine on every request and silently getting persisted to the database instead of the score shown on screen; applied the APP-02 Builder-shape-resume fix (previously deferred) to the ATS Checker; made the job description optional with an explicit `resume_only`/`targeted` mode; replaced the generic AI-failure banner with the real failure stage and message; unified the gap→checklist logic between the ATS Checker and the Optimiser into one shared module; moved the CGPA rule out of the AI-coaching path into a pure, directly-tested function; hardened both V2 AI prompts (JD-extraction breadth, evidence-matrix anti-templating) based on failures caught live during verification — including a live-caught JD-extraction regression (1 requirement instead of 19) fixed on the spot by strengthening the extraction validator. Live-proven against real providers: weak vs. strong resume on the same JD scored 34 vs. 70 (evidence-based discrimination, not keyword overlap); 16 gap-reason texts came back with 16 distinct openings (the templating bug from the report, confirmed fixed); a malformed JD cleanly failed across all 6 configured providers with no fabricated score. Added a missing `maxDuration` (this route had none, same class of bug as APP-02's fix on `/api/resume/optimization`). 342/342 tests (2 legacy-only files deleted, 5 new), TypeScript unchanged at 36, lint improved (24→9 errors on touched files from deleting legacy code), production build passes. **No High or Critical issues remain open.** |
| 11 Aug 2026 | APP-05 built: Hub (global community chat) taken from uncommitted WIP to a working, owner-requested "WhatsApp-style group chat" with maximum reasonable feature scope — text, images with captions, replies, editing, delete-own, per-user clear-chat, profile viewing, and a live presence ("N online") indicator, plus a full visual redesign. Six real bugs found and fixed along the way: a dead `/auth/login` redirect, a missing RLS UPDATE policy that would have silently blocked all edits, a second occurrence of the UI-03 Tailwind `max-w-md` collision (squished the profile modal to 16px), an unhandled-rejection bug that left the profile modal stuck loading forever on any fetch failure, a hover-only action menu that was completely unreachable on touch devices, a real SSR/client hydration mismatch on every message timestamp (`toLocaleTimeString` depends on timezone), and a collapsed-to-nothing image bubble caused by `next/image fill` combined with a percentage width on an intrinsically-sized flex ancestor. New migration (`hub_images_and_edit`) applied directly to the linked production database and verified live via direct query (columns, policy, and the new `hub-attachments` bucket all confirmed present). Every interactive path verified via a temporary preview route using direct DOM/computed-style inspection, not just screenshots — several of the bugs above were only conclusively caught that way. 342/342 tests (2 `schema-guard` fixtures updated for the new bucket), TypeScript unchanged at 36, lint clean, production build passes with all 4 new Hub API routes present. |

> The schema fixes applied directly to the Supabase database, so DB-01 – DB-05
> were live in production from the moment they were run. This deploy shipped the
> migration files, the type additions and the three documents.
