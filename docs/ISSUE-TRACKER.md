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
| **Fixed** | 4 | 2 | 0 | 0 | **6** |
| Open | 0 | 4 | 8 | 6 | 18 |
| Deferred | 0 | 0 | 1 | 1 | 2 |
| **Total** | **4** | **6** | **9** | **7** | **26** |

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

## ⬜ Open — Critical

*(none)*

---

## ⬜ Open — High

### DATA-01 · 376 listings link to a search page, not the job
The student clicks Apply and lands on a company careers homepage.
`stripe.com/jobs/search` **126** · `databricks …/open-positions/job` **125** · `mongodb …/careers/job` **52** · `highradius …/careers-list` **44** · `fivetran …/careers/job` **29**
Fix: rebuild the per-job URL from `gh_jid` (Greenhouse: `https://job-boards.greenhouse.io/<slug>/jobs/<id>`), or drop listings whose URL is a board root.

### DATA-02 · Internshala is 73% dead
27 of 37 listings render *"Applications are closed for this internship."* — verified against the live page, not inferred.
Fix: deactivate the 27, and teach the scraper that marker.

### DATA-03 · Link verification never runs
`link_status` is `NULL` on all 4,175 rows. The `link_status` and `link_checked_at` columns already exist; nothing populates them.
Scale check: my own 303-URL sweep took under 2 minutes at concurrency 10, so a full nightly pass over ~4,000 is roughly 7 minutes.

### SEC-01 · AI rate limiting covers 4 of 17 features
`RATE_LIMITS` in `lib/ai-gateway/index.ts` defines only `resume_parser`, `resume_ats`, `resume_optimizer`, `skill_extraction`. `checkRateLimit` does `if (!limit) return true`, so `jd_intelligence`, `evidence_evaluation`, `resume_ats_v2_*`, `hr_coaching`, `assistant`, `schema_repair`, `resume_polish` and `resume_target` are **unlimited**. An authenticated user can drain the provider quota.
Fix: a default limit instead of `return true`.

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
| Resume: optimisation | 35% | **45%** | Persistence unblocked; mockup replaced with an honest placeholder; generation not yet wired |
| AI Search | 35% | **50%** | DB blocker cleared; agent still undeployed |
| Certifications | 30% | **45%** | Table exists; no ingest pipeline yet |
| AI Voice Interview | 2% | 2% | |
| Auth | 90% | 90% | |
| Profile / Settings / Notifications | 85% | **90%** | Nightly cron fixed (DB-02) |
| **Overall** | **~58%** | **~63%** | |

---

## Next up

1. **Schema drift guard** — a startup check that fails loudly when a required table is missing, so DB-01 cannot recur silently
2. **Finish resume optimisation** — now unblocked: wire `lib/resume-optimizer/generate.ts`, score both resumes through `calculateAtsV2Score`, add the ATS-safe PDF export. This is what replaces the placeholder page from APP-01
3. **DATA-01** — the 376 dead-end apply links
4. **SEC-01** — rate-limit the other 13 AI features
5. **Deploy the AI Search agent** (see the handoff document)

---

## Log

| Date | Change |
|---|---|
| 10 Aug 2026 | Full audit; 25 issues catalogued |
| 10 Aug 2026 | DB-01 – DB-05 fixed and verified; database drift resolved |
| 10 Aug 2026 | APP-01 fixed — copilot mockup unlinked and replaced with an honest placeholder; dead `workspace-tools-panel.tsx` deleted. **No critical issues remain open.** |
| 10 Aug 2026 | Committed `f28e6c4` and deployed to production from `restore-june19` (the production branch). Deployment `opportunity-radar-h5741titk` Ready. Post-deploy check: `/` and `/login` return 200; `/search`, `/tracker`, `/resume`, `/certifications`, `/ai-search` all 307 to `/login?next=…` with the destination preserved. |

> The schema fixes applied directly to the Supabase database, so DB-01 – DB-05
> were live in production from the moment they were run. This deploy shipped the
> migration files, the type additions and the three documents.
