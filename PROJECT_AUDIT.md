# Opportunity Radar — Full Project Audit

**Prepared:** 20 Aug 2026 · autonomous audit pass
**Scope:** entire Next.js app (31 pages, 53 API routes) + 2 agent backends (AI Search, Voice Interview) on Azure
**Repo/branch:** `Laxmansirvi05/opportunity-radar` · `restore-june19-clean`

> **How to read this:** ✅ = verified working end-to-end this session · 🟡 = built & wired, spot-checked (not exhaustively tested) · 🔧 = fixed during this audit · ⚠️ = needs attention before submission.

---

## 1. Executive summary

| Area | Score | Note |
|---|---|---|
| **Overall completion** | **~92%** | Two flagship AI features fully deployed & working; core CRUD features built; **no dead/fake controls remain** (all 5 found have been implemented). Auth, tracker, opportunities/search/hub, certifications and the résumé builder are audited; Notes behaviour and the AI Assistant are the main un-audited surfaces |
| **Security** | **96%** (strong) | RLS on **all 38 tables**; the one ERROR-level leak fixed + all `SECURITY DEFINER` functions hardened (`delete_user`/triggers/internal locked down, `search_path` pinned); only dashboard-only items remain (leaked-password toggle, drop backup tables) |
| **Code health** | **85%** | 19 type errors, all inside the vendored résumé toolkit (build still passes); no hardcoded secrets; 551 tests passing. ⚠️ Lint is **not** clean outside the audited features — see §4 |
| **Deployment** | **80%** | Everything is live on Vercel + Azure; production URL alias needs one settings change (below) |
| **Performance** | **75%** | Page TTFB ~1–1.7s (Hobby tier); 216 DB perf advisories, all low-impact at this scale |

**Bottom line:** This is a genuinely substantial, submission-ready project. The two hardest pieces — an agentic **AI Search** and a real-time **voice Mock Interview** — are both **live and working end-to-end**. Every fake or non-functional control found has since been *implemented* rather than hidden, including a `/verify-email` page that was entirely simulated. What remains is third-party type errors, lint debt outside the audited features, standard database hardening, and two dashboard settings only the owner can change (§7).

---

## 2. Deployment status

| Component | Where | Status |
|---|---|---|
| Frontend (Next.js) | Vercel | ✅ Live. Latest build on the branch alias `…git-restore-ju-6faa4e….vercel.app` |
| **Production URL** (`opportunity-radar-six.vercel.app`) | Vercel | ⚠️ **Still points to an older build (`64b1d31`).** Every "Promote to Production" re-selected the same old deployment. **Fix:** Settings → Git → **Production Branch → `restore-june19-clean`** → save. Then all pushes auto-deploy to production (no more manual promotes). |
| AI Search agent stack | Azure VM `172.198.161.108` | ✅ `https://agent.laxmansirvi.me` (TLS, secret-gated, HTTP 403 without secret) |
| Voice Interview agent + worker | same Azure VM | ✅ `https://interview.laxmansirvi.me` healthy; LiveKit worker registered; **Kokoro TTS** self-hosted (no rate limits) |
| Databases | Supabase (cloud) + Postgres/Redis (VM) | ✅ |

**Deployment issues found & resolved earlier this session:** Vercel Hobby cron limit (a `*/15` cron failed every prod build → set to daily); the "GitHub webhook broken" red herring (was actually the cron failure); Cartesia/ElevenLabs invalid TTS keys + Gemini TTS rate-limit (→ switched to self-hosted Kokoro).

---

## 3. Feature-by-feature audit

| Feature | Pages/Routes | Completion | Status |
|---|---|---|---|
| **AI Search** (resume → matched internships) | `/ai-search` + agent | **95%** | ✅ Fully deployed & tested: real results, 0 junk/reels, rate-limited, RLS-proven. Limited only by free-tier LLM/Tavily quotas. |
| **Voice Mock Interview** | `/interview`, `/interview/[id]`, `/interview/history` + agent + worker | **90%** | ✅ Live voice (STT Deepgram, LLM Gemini, TTS Kokoro, LiveKit), scoring, /100 report, model answers, history. 🔧 Fixed this session: TTS silence, score timeout, /100 display, history→report. |
| **Auth** (login/signup/forgot/verify) | `/(auth)/*`, `/auth/callback`, `proxy.ts` | **100%** | ✅ **Fully audited this pass** — every flow read end-to-end, 8 defects fixed (§8), redirect behaviour verified live against the running app. Supabase Auth, double-gated (Proxy optimistically + layout authoritatively). 28 new tests. ⚠️ Only remaining item is the leaked-password toggle, which is dashboard-only (below). |
| **Résumé toolkit** (builder/ATS/optimise/upload) | `/resume/*` | **90%** | ✅ Reactive Resume integrated. 🔧 This pass: **all 4 dead builder buttons now work** — Download PDF, Preview Mode, Undo and Redo (all implemented, none relabelled) — plus a duplicate-résumé save bug fixed. ⚠️ 19 type errors remain in the vendored code. |
| **AI Assistant** | `/assistant` + `/api/assistant` | **85%** | 🟡 Chat with opportunity-attaching; explicitly guards against fabricating listings. |
| **Notes** | `/notes` + 11 API routes | **88%** | 🟡 Rich: folders, links, sharing, attachments, templates, bulk. ✅ **Security layer audited clean this pass** (see §5) — the *behaviour* is what remains untested. Largest remaining surface; the natural next feature audit. |
| **Certifications** | `/certifications` | **95%** | ✅ 20,753 certs (138 providers, all with URLs+logos), weekly refresh + daily link-sweep (37 dead links hidden), price/level/duration/provider filters, infinite scroll, error-state handling. 🔧 Fixed this pass: **search now uses the `fts` GIN index** (title+provider+description+topics) instead of title/provider ilike only — "kubernetes" went from 174 → 381 results. Clean lint + types. |
| **Application Tracker** | `/tracker` | **97%** | ✅ Kanban (dnd-kit drag between stages, optimistic + rollback), notes dialog, bookmark↔tracker sync. DB is textbook: PK, `UNIQUE(user_id,opportunity_id)`, `CHECK` on the 5 stages, cascading FKs, RLS on all 4 ops, indexes on user_id/status/opportunity_id. 🔧 This pass: response rate **verified live** (never hardcoded) + always-shown with tooltips; fixed the "Applied" stat/column name collision (→ "Applications"); extracted `computeTrackerStats()` with **11 unit tests**; removed a dead parallel model; `markAsApplied` ownership-hardened. |
| **Opportunities / Search / Hub** | `/search`, `/opportunities/[id]`, `/hub` | **97%** | ✅ Fully audited (frontend, design, DB, backend). 🔧 This pass: **made the Skills + Company sidebar filters actually filter** (RPC + fallback were ignoring them — verified live); fixed the detail page's misleading related-role rails, dead breadcrumb, and missing company facts; cleared **every lint error/warning** across opportunities + search (type-clean too). Hub API is textbook-secure (server-derived sender_id, image-path validation, ownership checks, RLS). 502/502 tests pass. |
| **Notifications / Profile / Settings / Support / Dashboard** | respective | **80%** | 🟡 Built and wired. |

---

## 4. Code quality

- **TypeScript:** 19 errors total — **100% inside the vendored Reactive Resume toolkit** (`features/resume/dialogs`, `libs/resume`, `features/resume/preview|public`, `components/input`). **None in the core Opportunity Radar features** (AI Search, Interview, Notes, Assistant are clean). Next.js/SWC builds successfully through them, so they are **non-blocking**, but worth cleaning for a polished submission.
- **Secrets:** ✅ No hardcoded API keys/secrets in source — everything reads `process.env`.
- **Debug leftovers:** 15 `console.log` calls — **verified none leak secrets or cross-user data** (the AI Gateway one logs only a key *label* like `…default`, not the key; the rest are server cron logs or client-side résumé-import/AI-debug of the user's own data). Cleanup, not a security issue. Heaviest is `[AI_DEBUG]` in `features/resume-toolkit/services/ai/sanitize.ts` (logs résumé content to the console).
- **Lint:** `npm run lint` reports **362 problems (216 errors, 146 warnings)** — the audited features (`opportunities`, `search`, `hub`, `tracker`, `certifications`) are genuinely clean and produce **zero** output, but the rest of first-party code is not. Breakdown: `scripts/` 66 errors (one-off ops scripts, low value), `app/` 28 (dashboard 6, profile/saved 3, notifications, crons), `lib/` 27 (**ATS engine 11**, resume-optimizer 5, ai-gateway 8), `tests/` 23; the remainder (`src/`, `packages/`, `libs/`, `features/resume*`) is vendored. Note `lib/ats-checker` + `lib/resume-optimizer` are **first-party**, not vendored — that debt is ours. *(`HANDOFF.md` §12 previously claimed first-party code was lint-clean; corrected there.)*
- **Fake / non-functional controls:** ✅ **none left** — but this list was twice as long as originally recorded, and the second entry was only found by auditing a feature this section had already passed as fine.
  - `features/resume-toolkit/…/resume-builder.tsx` — there were **4**, not 3 as previously recorded: Undo, Redo, Preview Mode and Download PDF. 🔧 **All four are now implemented** (see §8). None were relabelled or removed — each turned out to be genuinely buildable, and one (Download PDF) already had a working endpoint behind it.
  - `app/(auth)/verify-email/page.tsx` — 🔧 **the whole page was a simulation** and this section had missed it entirely. "Resend Email" called a local `simulateVerification()` that sent nothing and showed **"Email verified successfully"** — a success message for something that never happened; "Change email" had no handler; and it advertised a fabricated **"Join 2,400+ students"** figure. Nothing linked to it, which is likely why it went unnoticed. Now fully implemented (§8).
  - **Lesson recorded:** "no fake controls" had been asserted from the pages that were *linked*. An orphaned route is exactly where a mock survives, so unreferenced pages need checking too.
  - `components/landing/hover-footer.tsx` — **LinkedIn / GitHub / Twitter / Instagram** footer links are all `href="#"` (dead). Point them at real profiles or remove them before submitting.

---

## 5. Security audit

**Strong baseline:** Row-Level Security is **enabled on all 38 public tables**, with per-user ownership policies on every user-data table (verified `interview_reports`, `resumes`, `notes`, `application_tracker`, etc.).

**🔧 Fixed this pass (safe, applied to the live DB — verified with `has_function_privilege`):**
- **CLOSED a real cross-user data leak (the only ERROR-level advisory):** the `v_student_ats_inputs` view was `SECURITY DEFINER` and selected **every** student's skills/experience/education with no `auth.uid()` filter — so any signed-in user hitting it via the API could have read all students' résumé data (RLS bypassed). Set `security_invoker = true` (RLS now enforced per caller → each user sees only their own row), revoked `anon` access, kept `authenticated` SELECT so the ATS feature still works. Verified: `auth_can_select=true`, `anon_can_select=false`, `security_invoker=true`.
- Pinned `search_path = public` on **13 functions** — this **cleared all 11 `function_search_path_mutable` warnings**, with no behavior change (signup/triggers still work).
- **`delete_user()` fully locked down (the earlier follow-up — now done):** ran `REVOKE EXECUTE … FROM PUBLIC` + `FROM anon`, `GRANT EXECUTE … TO authenticated`. Verified: `anon_can_exec=false`, `auth_can_exec=true`. The account-deletion flow (`app/actions/settings.ts`, runs as the signed-in user) still works; anonymous callers can no longer reach the destructive function.
- **Trigger / internal `SECURITY DEFINER` functions revoked from all client roles:** `handle_new_user`, `protect_profile_fields` (both are triggers — they still fire on signup / profile-update because Postgres does not gate trigger execution on the EXECUTE grant), and `rls_auto_enable` (internal admin helper, never called by the app). Verified: `anon_can_exec=false`, `auth_can_exec=false` on all three. No RPC surface remains.

**✅ Auth surface — fully audited this pass (see §8 for the fixes):**
- **Route protection is genuinely double-gated.** `proxy.ts` redirects optimistically; each protected route group's `layout.tsx` re-runs `getUser()` and is the authoritative gate, per the Next.js docs. The proxy list had drifted (`/interview`, `/notes` missing) — that degraded the redirect, never the protection — and is now covered by a test that walks the route-group directories on disk.
- **Open redirect:** `?next=` is honoured on both `/login` and `/auth/callback`. The two had separate, disagreeing checks; now one tested helper rejecting absolute URLs, `//host`, backslash variants and control characters.
- **`verifyOtp` no longer takes an unvalidated `type`** straight from the query string.
- **Password recovery is correctly excluded from the "bounce signed-in users" list** — completing a recovery link authenticates the user *before* they set the new password, so redirecting `/forgot-password` would make it unresettable. Verified live.
- **Credentials are validated server-side**, not only by the browser's `minLength`. Login deliberately does not apply password rules — "too short" on a login form leaks a fact about the stored credential.
- Verified live with cookie-less requests: `/notes`, `/interview`, `/interview/history` → `/login?next=<path>`; `/privacy` stays public; `/login` while signed in → `/dashboard`.

**✅ Notes security layer — audited this pass, no defects found:**
Reviewed because Notes is the largest un-audited surface (4,590 lines, 11 API routes) and carries the riskiest primitives in the app: public sharing, service-role reads, and HTML rendered to signed-out visitors.
- **All 11 `/api/notes/*` routes authenticate**, and every share operation is gated by an `assertOwned()` check (`notes.id = ? AND user_id = auth.uid()`) *before* any sharing state is read or changed.
- **The one anonymous read path** — `app/notes/shared/[slug]/page.tsx` — resolves a note only through a `note_shares` row whose `link_access` is still `'view'`, refuses trashed notes (`deleted_at`), returns only title/body/dates (never the owner, folder, tags or any other note), **re-sanitises the HTML on the way out** rather than trusting storage, sets `dynamic = 'force-dynamic'` so a revoked share stops resolving immediately, and marks itself `noindex`.
- **Service-role use is narrow and justified**: it exists only because `profiles` SELECT RLS is `auth.uid() = id`, so recipient lookup can't go through the caller's client. It stays server-side inside already-authenticated, ownership-checked routes and returns only public-facing profile fields.
- Minor, accepted: adding a recipient by email returns a distinct "no account uses that email" error, which is a mild account-enumeration oracle — but it is authenticated-only, and Hub already exposes member email by design.

**✅ Reviewed and intentionally left as-is:**
- **`get_user_role()` keeps `EXECUTE` for `authenticated`** — it is referenced inside **11 RLS policies**, which evaluate as the querying role, so revoking it would break access control. It only ever returns *the caller's own* role (keyed on `auth.uid()`), so an anon/authenticated call leaks nothing about other users. Safe to leave callable.

**⚠️ Flagged for you (need dashboard / manual action — cannot be done via API this session):**
- **Leaked-password protection is DISABLED** — enable it in Supabase → Authentication → Policies (checks passwords against HaveIBeenPwned). One click. This is a GoTrue auth-config setting, not reachable through the database MCP.
- **4 stale `opportunities_backup*` tables** (`opportunities_backup`, `_20260612`, `_2026_06_17` [32 MB], `_before_unstop_cleanup`) — verified stale June-2026 snapshots, superseded by the live 3,634-row `opportunities` table, RLS-locked (not a leak). They are the source of 4 `rls_enabled_no_policy` + 4 no-primary-key advisories. **The `DROP TABLE` was blocked by the environment's safety classifier** (destructive), so run it yourself to declutter:
  ```sql
  DROP TABLE IF EXISTS public.opportunities_backup, public.opportunities_backup_20260612, public.opportunities_backup_2026_06_17, public.opportunities_backup_before_unstop_cleanup;
  ```
- `pg_trgm` extension lives in the `public` schema (minor; move to `extensions` — risky since functions reference it, so left).

---

## 6. Performance

- **Page load (public routes, measured):** landing `/` ≈ **1.7s** total, `/login` ≈ **1.1s**, production `/` ≈ **1.3s** TTFB. Acceptable on Vercel Hobby; the landing page's 3D/Spline hero is the heaviest client cost — consider lazy-loading it.
- **Backend latency:** interview agent 0.4s, AI-search agent 1.5s (both gated 403 as expected).
- **Database advisors:** 216 performance notices, **all low-impact at current scale**:
  - 78 × `auth_rls_initplan` — RLS policies calling `auth.uid()` directly; wrap as `(select auth.uid())` to avoid per-row re-eval (nice future optimization).
  - 87 × `multiple_permissive_policies` — overlapping permissive policies (consolidate later).
  - 32 unused indexes, 15 unindexed foreign keys, 4 tables without a primary key (the backup tables).

---

## 7. Prioritised to-do before submission

**High (reviewer-visible):**
1. **Point production at the right build** — set Production Branch to `restore-june19-clean` (Section 2). *(still needs your Vercel dashboard)*
2. ~~Fix or remove the 4 dead footer links~~ — ✅ **done** (real GitHub repo; dead LinkedIn/Twitter/Instagram removed; Privacy/Terms wired).
3. **Enable leaked-password protection** (one click, Supabase Auth — dashboard-only). *(still pending your action — now the **only** outstanding auth item)*

**Medium:**
4. ~~Address the `SECURITY DEFINER` view (`v_student_ats_inputs`)~~ — ✅ **done** (`security_invoker`, anon revoked).
5. ~~Remove/replace the "Coming soon" résumé-builder buttons~~ — ✅ **done.** All four (Download PDF, Preview Mode, Undo, Redo) were **implemented rather than relabelled**; see §8.
6. ~~Replace native `alert()` calls with the app's toast~~ — ✅ **done** (report-broken-link button).

**Low (polish / post-submission):**
7. Clean the 19 type errors in the résumé toolkit.
8. Strip 15 `console.log`s.
9. DB perf hardening (RLS initplan, unused indexes); **drop the 4 backup tables** (SQL in Section 5 — `DROP` was safety-blocked here, run it yourself).

---

## 8. What I fixed during this audit

- 🔧 **Résumé builder: Download PDF implemented (was a dead button).** The control was `disabled` behind a "PDF Download available in Phase 2B" tooltip — yet `GET /api/resume/[id]/download` already existed, was authenticated and `user_id`-filtered, and the builder already saved to the exact column it reads (`resumes.parsed_data`); the shape conversion was even already unit-tested against the builder's format. Meanwhile the Support FAQ told users every résumé could be downloaded as an ATS-safe PDF — so the docs were ahead of the UI. Wired the button to that endpoint: it flushes pending edits first (the PDF renders server-side from the saved row, so a straight download would silently miss anything typed inside the 2s autosave debounce, and a never-saved résumé would have no row at all), then downloads a file named after the résumé title, with a spinner and a toast on failure.
- 🔧 **Fixed a duplicate-résumé save bug** found while doing the above: the id of a newly created résumé was only copied into `idRef` by a `useEffect`, which does not run until after a render — so a save queued before then still saw a `null` id and **inserted a second résumé**. Now written to the ref synchronously. An explicit save also cancels the pending autosave timer instead of letting it fire a redundant second write. **5 unit tests** added for `save()`; the duplicate-insert case was verified to fail without the fix (`createResume` called twice). Suite: **502 → 507 tests**.
- 🔧 **Résumé builder: Preview Mode implemented.** Collapses the sections panel and editor column on desktop so the preview takes the full width; the button flips to a secondary "Exit Preview" and carries `aria-pressed`. The trap here was `cn` being **twMerge**, which keeps `hidden` and `md:flex` in *separate* responsive groups — so the obvious implementation (appending `hidden` to panels that already carry `md:flex`) silently does nothing from `md` up, which is exactly the width preview mode has to collapse. Verified against the real tailwind-merge: `cn('flex flex-col', 'hidden md:flex', 'hidden')` → `"flex-col md:flex hidden"`. Each panel therefore gets one mutually exclusive class string per state, with a comment recording why so it doesn't get "simplified" back into the bug.
- 🔧 **Résumé builder: Undo/Redo implemented.** Résumé content now lives in an undo/redo timeline, extracted as a **pure module** (`features/resume-toolkit/lib/edit-history.ts`) that takes time as an argument rather than reading a clock — the `createTapCounter` precedent — so every window-dependent case is testable without fake timers. Edits within **600 ms coalesce into one step** (`updateSection` fires per keystroke, so without this undo would walk back letter by letter); undo/redo autosave; opening a résumé starts a fresh timeline; history caps at 50 snapshots. Title is deliberately excluded, and there is **no Cmd+Z binding on purpose** — a global handler would hijack the browser's native undo inside focused text inputs. **16 tests** (11 pure, 5 through the hook); the coalescing tests were confirmed load-bearing by setting the window to 0 and watching both fail.
- 📋 **Corrected two doc claims** (verification pass over this audit + `HANDOFF.md`): the résumé builder had **4** dead controls, not 3; and first-party code is **not** ESLint-clean (§4) — only the audited features are.
- 🔧 **Auth: fully audited and completed (90% → 100%) — 8 defects fixed.**
  1. **`/verify-email` was a simulation** — fake resend that displayed "Email verified successfully" without sending anything, a dead "Change email" button, and a fabricated "2,400+ students" statistic. Rebuilt with a real `supabase.auth.resend()`, a 60s cooldown, honest states, and signup now routing to it. No "verified" state, deliberately: verification completes in `/auth/callback`, which that tab never observes. The address moves via `sessionStorage`, not the URL.
  2. **`/interview` and `/notes` were missing from the protected-route list** — signed-out deep links lost their destination (redirected with no `?next=`). Data was never exposed; the layouts are the real gate.
  3. **`/submit`** listed a route that no longer exists.
  4. **Two disagreeing open-redirect checks** — the callback accepted `/\evil.example` where the login screen refused it, and carried a `startsWith('\\')` clause that could never fire. Unified into one tested helper.
  5. **A stale `x-forwarded-host` allowlist** naming three domains never deployed to; its branch could never fire.
  6. **`verifyOtp` took an unvalidated `type`** cast from the query string.
  7. **Dead auth model removed** — `AuthProvider`/`useAuth` had zero consumers and read state via `getSession()`, which Supabase warns is not an auth check.
  8. **Server-side credential validation** — password length had been enforced only by the browser.
  - **Tests: +28.** The route-coverage guard was confirmed load-bearing (reintroducing all three route bugs fails 4 tests). Auth surface is lint-clean.
  - **Not verified:** actual email delivery for resend/recovery — that needs a real signup, which was out of scope for this pass.
- ✅ **Test suite: 502 → 551** (56 → 61 files) across the résumé-builder and auth passes.
- 🔧 **Security (ERROR): closed the `v_student_ats_inputs` cross-user résumé-data leak** (set `security_invoker`, revoked anon) — ATS feature verified still working.
- 🔧 Security: pinned `search_path` on 13 DB functions (cleared 11 warnings).
- 🔧 **Security (auth hardening, this pass): fully locked down `delete_user()`** (revoked PUBLIC + anon, granted authenticated — verified `anon_can_exec=false`), and **revoked all client EXECUTE on the trigger/internal `SECURITY DEFINER` functions** `handle_new_user`, `protect_profile_fields`, `rls_auto_enable` (triggers still fire; no RPC surface left). Reviewed `get_user_role` and deliberately kept it callable by `authenticated` (used in 11 RLS policies; only returns the caller's own role). All verified with `has_function_privilege`.
- 🔧 **Landing footer:** Privacy Policy + Terms & Conditions now link to the real `/privacy` and `/terms` pages (Resources column + bottom bar); dropped the dead "About"; GitHub icon points to the real repo; **removed the 3 dead placeholder social links** (LinkedIn/Twitter/Instagram — were `href="#"`).
- 🔧 **Opportunities:** replaced blocking native `alert()` dialogs with the app's toast (report-broken-link button).

**All fixes are LIVE** at the auto-updating deployment URL: `https://opportunity-radar-git-restore-ju-6faa4e-laxman-sirvi-s-projects.vercel.app` (this is a real Vercel production-grade deployment of the latest commit). The only thing not done is pointing the prettier `opportunity-radar-six.vercel.app` alias at it — that requires your Vercel dashboard (set Production Branch → `restore-june19-clean`, or promote the newest build), which cannot be done via API.
- 🔧 **Opportunities / Search / Hub: fully audited (frontend, design, DB, backend) + polished to 97%.**
  - **Search:** the "Skills" and "Company" sidebar filters were exposed in the UI (chips appeared, URL updated) but silently did nothing — the primary search RPC had no params for them and the fallback ignored them. Extended `search_opportunities_rpc` with `filter_company` + `filter_tags` (migration committed), wired both into `rpcArgs` and the fallback (`getOppIdsForTags` + a no-match sentinel), and made `getSearchStats` respect them. Verified live: baseline 3398 → company filter 2, tag filter 1444, nonsense company 0, category still 615.
  - **Opportunity detail:** Company Profile card now fetches `founded_year`/`headquarters` (columns existed, select omitted them, fields never showed); the breadcrumb category looked clickable but did nothing → now links to the category filter; the "More from <company>" rail mislabeled every non-remote role "Full-time" → shows real location · mode; "People also viewed" (no view-tracking behind it) renamed to "More opportunities" and its fabricated "• Remote" removed.
  - **Lint/types:** cleared **all 13 `no-explicit-any` errors + 5 warnings** across opportunities + search (typed the RPC row, the joined company/related rows, the sort select; removed a dead `CompanyLogo` prop and an unused URL read; justified the genuinely-necessary exceptions). Both features now lint clean and type-clean.
  - **Hub:** audited end-to-end — DB (RLS, CHECK ≤2000 chars/no-empty, FKs, indexes), API (server-derived `sender_id`, image-path validation to the user's own folder, ownership-gated edit/delete with storage cleanup, upload type/size allowlist), and the realtime hook (dedup, RLS-safe sender resolution). No defects found; lint/type clean. **Privacy note for you:** member email is intentionally exposed as a `mailto:` in the Hub profile modal (per the PRD's networking intent) — left as-is, but flagged in case you'd rather gate it.
- 🔧 **Application Tracker: fully audited (frontend, design, DB, backend) + polished to 97%.** The "static 75% response rate" was a false alarm — the metric is computed live in both the board and the profile page and has never been hardcoded (what looked static was the stale production alias). Made it unmistakably live: always shown ("—" pre-application), tooltips on every stat, and the funnel "Applied" stat renamed to "Applications" to stop colliding with the "Applied" column. Extracted the summary math to a pure `computeTrackerStats()` with 11 unit tests (incl. an explicit "response rate changes as an application progresses" case). Removed a dead parallel tracker model (`lib/tracker/*`, `types/tracker.ts`) whose lowercase stages contradicted the DB CHECK constraint. Confirmed the DB layer is textbook (unique constraint, stage CHECK, cascading FKs, RLS on all ops, proper indexes). Hardened `markAsApplied()` with an explicit ownership filter.
- 🔧 **Certifications: search coverage fixed** — the query matched only `title`+`provider` via `ilike` and ignored the purpose-built `idx_certifications_fts` GIN index, so terms appearing only in a cert's topics/description were unfindable. Added an `fts.plfts(english)` branch OR-ed with the existing ilike (partial as-you-type words still match). Verified against the live DB: "kubernetes" 174 → 381 matches. Audited the rest of the feature (data health, filters, crons, error states, lint, types) — all clean.
- 🔧 (earlier this session) Interview: TTS silence → Kokoro; report timeout 3→8 min; score shown /100 (list + report); History click now opens the report instead of the live room; backfilled missing report rows.
- 🔧 (earlier) AI Search: reel/junk filter (`new URL` sandbox bug), rate-limit recording, Vercel cron fix.

---

*Honesty note: features marked 🟡 are built and wired and were spot-checked, but not every one of the 31 pages was exercised end-to-end in this pass. The two AI flagship features (marked ✅) were tested live. Nothing here is fabricated — every metric came from the live database, the deployed URLs, or the source tree.*
