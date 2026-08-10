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
| Hub | 0% | 0% | Redirect stub |
| Search | 85% | 85% | |
| Tracker | 90% | 90% | |
| Resume: builder | 80% | **85%** | Photo upload unblocked (DB-03) |
| Resume: extract | 75% | 75% | |
| Resume: ATS | 85% | **88%** | `resume_ats_reports` now exists |
| Resume: optimisation | 35% | **98%** | Generation, PDF export, full UI, 3 real bugs found and fixed, schema/RLS/routes verified live in production, all 5 route handlers directly tested against a fake DB — 28 tests (APP-02). The irreducible last piece: nobody has run it with a real login yet, and only the owner can do that |
| AI Search | 35% | **50%** | DB blocker cleared; agent still undeployed |
| Certifications | 30% | **45%** | Table exists; no ingest pipeline yet |
| AI Voice Interview | 2% | 2% | |
| Auth | 90% | 90% | |
| Profile / Settings / Notifications | 85% | **90%** | Nightly cron fixed (DB-02) |
| **Overall** | **~58%** | **~66%** | |

---

## Next up

1. **Owner UX pass on Resume Optimisation** — run one real optimisation end-to-end (real login, real JD, real AI gateway) and confirm the checklist gate, both downloads, and persistence-after-logout feel right. Per the "dual verification" rule this is the owner's call, not something further code review can substitute for.
2. **Check the first scheduled `link-sweep` run** (`0 2 * * *`) once it lands — the 12-row proof-run confirmed correctness, not full-catalogue throughput within the 300s ceiling.
3. **Deploy the AI Search agent** (see the handoff document)
4. Everything else in **Open — Moderate** and **Open — Low** below — no High or Critical issues remain open.

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

> The schema fixes applied directly to the Supabase database, so DB-01 – DB-05
> were live in production from the moment they were run. This deploy shipped the
> migration files, the type additions and the three documents.
