# Database and Data Quality Audit — Opportunity Radar

Audit date: 14 Nov 2026, ~17:45–18:05 UTC
Database: Supabase project `opportunity-radar` (`pkfghzeeyqngpquaspuz`, ap-south-1 Mumbai, Postgres 17.6). This is the **production** database.
Method: catalog queries and `SELECT`s only. The RLS isolation tests ran inside `DO` blocks that always end with `RAISE EXCEPTION`, so every write was rolled back and no rows remain. No cleanup, migration or DDL was run.

---

## 1. Schema overview

36 tables in `public`, and RLS is enabled on all 36. Row counts:

| Table | Rows | Table | Rows |
|---|---|---|---|
| opportunities | 4,759 | certifications | 23,389 |
| opportunity_tags | 31,841 | companies | 4,677 |
| ingestion_logs | 343 | ai_usage_log | 288 |
| source_registry | 82 | chat_messages | 28 |
| application_tracker | 25 | note_folders | 21 |
| recently_viewed | 17 | profiles | 16 |
| sessions | 16 | resume_ats_reports | 13 |
| login_attempts | 11 | resumes | 10 |
| chat_conversations | 9 | ai_search_jobs | 9 |
| hub_messages | 9 | resume_optimizations | 7 |
| bookmarks | 5 | notes | 4 |
| notifications | 3 | achievements | 3 |
| note_attachments | 1 | interview_sessions / interview_reports | **0 / 0** |
| reports, audit_log, saved_searches, resume_versions, ingestion_queue, note_links, note_shares, note_share_recipients, email_resend_logs | 0 | | |

Observations:
- **16 user profiles.** Real usage is very small, so most user-facing features have little production evidence.
- `interview_sessions` = 0: the AI voice interview has **never** produced a persisted session in production, or its rows were purged (`purge-interviews` cron).
- `ingestion_queue` = 0, `resume_versions` = 0, `saved_searches` = 0: these are unused subsystems.
- 4,677 companies but only ~715 linked to published listings (`landing_stats`). About 3,960 company rows are orphaned history.

## 2. Migration drift (repo vs production)

| Category | Count | Detail |
|---|---|---|
| Repo migrations | 70 files | `supabase/migrations/` |
| Production migration history | 64 entries | `supabase_migrations.schema_migrations` |
| In repo, not in prod history | 18 | e.g. `20260811120000_hub_images_and_edit`, `20260812010000_interview_feature`, `20260816120000_notes`, `20260816090000_fix_new_user_name_metadata_key` … |
| In prod history, no repo file | 2 | `20260816144202 note_folder_counts_view`, `20260817181719 deepinterview_sessions_grants` |

Spot checks show most of the 18 *were* applied by hand under different versions: `hub_messages.image_url`, `certifications.certificate_image` and the `note_preview_rows` view all exist. **One was not applied:** `fix_new_user_name_metadata_key`. Production `handle_new_user()` still reads only `name`, while the signup form sends `full_name` (confirmed with `pg_get_functiondef`). Email sign-ups therefore get their email prefix as display name; 2 of 16 profiles currently show this.

**Consequence:** `supabase db reset` on a fresh project would not reproduce production. This blocks safe staging environments.

## 3. RLS and privilege review

### Confirmed vulnerabilities (rolled-back tests)

| ID | Severity | Table | Issue | Test result |
|---|---|---|---|---|
| DB-SEC-01 | **High** | `note_shares` | The `note_shares_owner_all` policy checks only `owner_id = auth.uid()`, never that the note belongs to the caller. Any signed-in user can create a `link_access='view'` share for **another user's note**. `/notes/shared/[slug]` then renders it publicly through the service-role client. | As user A, `INSERT note_shares(note_id = <B's note>, owner_id = A, …)` → **succeeded** (rolled back). |
| DB-SEC-02 | **High** | `note_share_recipients` | Same flaw. With two accounts, A can add a recipient row for B's note naming account C. C can then **read and edit** B's note via `notes_select_shared_with_me` / `notes_update_shared_with_me`. | C's visible count of B's note went from **0 to 1** after A's insert (rolled back). |

Both require knowing the victim note's UUID (v4, not guessable), so exploitation needs an ID leak. However, the API route's ownership check is bypassable: PostgREST is reachable directly with the public anon key and a user's JWT.

### Reviewed and acceptable

- `profiles`: users cannot escalate `role`. The trigger `protect_profile_fields` resets `role`, `email`, `is_suspended`, `suspended_at` and `deleted_at` for non-admins. SELECT is own-row only.
- bookmarks, application_tracker, resumes, notes, chat_*, achievements and resume_* are `auth.uid() = user_id` scoped. UPDATE policies without `WITH CHECK` fall back to `USING`, which is safe.
- `opportunities`: anon can read only `Published` / `Closing Soon` / `Expired`. Student inserts are forced to `Pending Review`.
- `login_attempts`, `email_resend_logs`, `ingestion_queue`: RLS on with no policies, so they are service-role only (intended).
- SECURITY DEFINER helpers `check_*`, `log_*` and `login_hint_for_email` are not executable by anon or authenticated.

### Lower-severity observations

| ID | Severity | Observation |
|---|---|---|
| DB-SEC-03 | Medium | `note-attachments` bucket is **public**, allows `image/svg+xml`, and is served with permanent `getPublicUrl` links. Attachments to private notes are readable by anyone holding the URL, forever, including after the note is deleted. |
| DB-SEC-04 | Low | `hub-attachments` bucket is public. The privacy policy says Hub content is visible to "signed-in students", but images are world-readable by URL. |
| DB-SEC-05 | Low | `ingestion_logs` is readable by every signed-in user (`auth.uid() IS NOT NULL`), which exposes operational detail. |
| DB-SEC-06 | Low | `get_user_role()` (SECURITY DEFINER) is executable by `anon`. It returns NULL for anon, so the leak is negligible (advisor WARN). |
| DB-SEC-07 | Low | `resume-toolkit` and `report-evidence` buckets have no size or MIME limits. They are currently empty. |
| DB-SEC-08 | Low | Supabase Auth "leaked password protection" is disabled (advisor). |
| DB-SEC-09 | Info | `pg_trgm` is installed in `public` (advisor). |

## 4. Account deletion vs storage

All user tables cascade from `auth.users` / `profiles`, so `delete_user()` correctly removes database rows. **Storage objects are never deleted.** Live evidence:

| Bucket | Objects | Belonging to users who no longer exist |
|---|---|---|
| resumes (private) | 6 | **3** |
| hub-attachments (public) | 3 | **2** |
| avatars (public) | 7 | **1** |

The privacy policy says deletion "permanently erases your profile, saved resumes …". The résumé PDFs of deleted users still exist. → **P0 privacy issue.**

`note_attachments` has 1 row, but the `note-attachments` bucket has 0 objects: an orphaned metadata row.

## 5. Opportunity data quality

### 5.1 Composition (published = what students can see)

| Measure | Value |
|---|---|
| Total rows | 4,759 |
| Published | 2,963 (search RPC returns 2,921 after hiding past-deadline rows) |
| Expired (kept) | 1,796 |
| By category (published) | Job 1,951 · Internship 874 · Hackathon 123 · Competition 13 · Scholarship 2 · **Workshop 0** |
| By country (published) | IN 2,534 (85.5%) · INTL 429 (14.5%), matching the 15% international cap |
| By source (published) | amazon 819 · greenhouse 760 · internshala 590 · unstop 417 · lever 322 · smartrecruiters 53 · ycombinator 2 |
| `trust_tier` | 3 on every row (no differentiation) |
| `source_type` | NULL on every row |

**Student relevance:** 1,267 of 1,951 published Jobs (**65%**) have senior-level titles (senior / staff / lead / principal / manager / director / II / III …). Only 144 look entry-level. Examples: "Sr Principal Data Scientist", "Enterprise Account Executive – China", "Senior Account Executive, Startups (SoCal)". For a student platform this is the biggest relevance problem.

### 5.2 Completeness (published rows)

| Field | Missing | % missing |
|---|---|---|
| experience_level | 2,963 | **100%** |
| employment_type | 2,963 | **100%** |
| mode | 2,668 | 90% |
| is_paid | 2,946 | 99% |
| salary_range | 2,193 | 74% |
| requirements | 2,144 | 72% |
| source_url | 1,978 | 67% |
| deadline | 1,137 | 38% (ATS sources do not publish deadlines, so this is legitimately "not published") |
| description < 100 chars | 57 | 2% |
| skills/tags empty | 90 | 3% |
| location / company / apply_url | 0 | 0% |

Note: `is_remote` is populated (1,399 true / 1,564 false). Only `mode` is empty, and the search filters read `mode` (see section 6).

### 5.3 Deadlines

| Measure | Value |
|---|---|
| Published with deadline in next 24h / 7d / 30d | 66 / 341 / 1,729 |
| Published but deadline already passed | 42 (all dated 14 Nov; hidden by the search RPC, expired by the 23:00 UTC maintenance job) |
| Deadline before posted_at / posted in future | 0 / 0 |
| Expired but deadline in future | 363 (all Amazon; 356 with link 404, so legitimately removed) |
| **Fabricated deadlines** | **All 819 published Amazon rows.** `AmazonProvider.ts:104` sets `deadline = now + 30 days` on every run. Amazon publishes no deadline; students are shown an invented one. |
| **Timezone loss** | Date-only deadlines ("Apply by 14 Nov '26") are parsed with `new Date()` on a UTC server, giving 00:00 UTC = **05:30 IST**. Listings disappear ~18.5 h before the real Indian deadline. 590 rows are stored at exactly 00:00 UTC. |

### 5.4 Freshness and ingestion health

| Source | Published | Last seen (max) | Published but unseen > 7 days | `ingestion_logs` last entry |
|---|---|---|---|---|
| amazon | 819 | 13 Nov | 355 | 13 Nov (SUCCESS) |
| greenhouse | 760 | 13 Nov | 320 (oldest 9 Aug) | **9 Aug** |
| internshala | 590 | 13 Nov | 254 | **9 Oct** |
| unstop | 417 | 13 Nov | 233 (oldest 9 Aug) | **10 Oct** |
| lever | 322 | **2 Nov** | **322 (all)** | **9 Aug** |
| smartrecruiters | 53 | 13 Nov | 40 | (via AtsBoard, 9 Aug) |
| ycombinator | 2 | never | n/a | 13 Nov (0 inserted, 330 rejected in 14 days) |

Diagnosis:
1. **Most provider runs never finish.** `logRun()` and the reconciliation step run only at the end of `runPipeline()`. Internshala, Unstop and the employer-ATS crons have not written a log since August–October, yet their rows keep being touched. This is the signature of runs killed by the function time limit (`maxDuration` 300 s) before completion. As a result:
   - stale listings are **never reconciled away** (1,524 published rows unseen for over 7 days, some since August), and
   - failures are **invisible**: no log row, no alert.
2. **Lever has stopped updating** (no row seen since 2 Nov), although `source_registry` marks the Lever boards `last_ok_at = 13 Nov`.
3. YC provider: 0 inserts in 14 days. Its two remaining rows are generic "X is hiring" Hacker News posts linking to `/careers`, not concrete opportunities.
4. Historic logs show `provider = 'r'` / `'i'` (minified class names). This was fixed on 8 Oct; the historic rows are noise.
5. The status-case mismatch (`SUCCESS` vs lowercase in older code) is cosmetic.

### 5.5 Link verification (sample of 150 published listings, 14 Nov 2026)

Stratified random sample, 25 per source (all for YC). Methods: HTTP GET with redirects, page-text closed markers, and for ATS sources the **authoritative board APIs** (`boards-api.greenhouse.io`, `api.lever.co`). No forms were submitted.

| Source | Sample | Live (confirmed) | Closed / dead | Unverifiable | Method notes |
|---|---|---|---|---|---|
| Internshala | 25 | 18 | **7 (28%)** | 0 | "Applications are closed for this internship" banner on a 200 page |
| Lever | 25 | 18 | **7 (28%)** | 0 | Lever API 404; the public pages still answer 200 |
| Greenhouse | 27 | 21 | **6 (22%)** | 0 | Greenhouse board API 404 (5 Stripe, 1 Pinterest) |
| Amazon | 27 | 27 (HTTP 200) | 0 detected | closure not detectable from page | deadlines fabricated (5.3) |
| SmartRecruiters | 22 | 22 (HTTP 200) | 0 detected | JS-rendered, "expired" marker not present | likely live, not confirmed |
| Unstop | 21 | 21 (HTTP 200) | 0 detected | SPA; registration state not in HTML | likely live, not confirmed |
| YC | 2 | — | — | 2 (host not in allowlist) | generic careers pages |

**Every one of the 20 closed listings had `link_status = 200` in the database.** The link sweep checks HTTP status only, and these boards return 200 for closed postings. Projected across the catalogue, roughly **1 in 4 Internshala / Lever / Greenhouse listings a student clicks is already closed.** Domains were all genuine employer or authorised-ATS domains; nothing suspicious was found.

### 5.6 Duplicates

| Rule | Groups | Rows |
|---|---|---|
| Exact `apply_url` | 0 | 0 |
| Exact `canonical_url` | 0 | 0 |
| URL without query string | 6 | 482 (false positive: `stripe.com/jobs/search?gh_jid=…` uses the query string as the job id) |
| Same company + title | 5 | 10 |
| Cross-source same company + title | 0 | 0 |

The 5 pairs (confidence: low that these are true duplicates):
- Paytm "Legal Contracts" ×2 (both Noida) and Paytm "Product Management – UPI" ×2 (both Noida): **likely true duplicates** (same city, different Lever IDs). Keep the most recently seen.
- Paytm "KAM – Manager – Paytm Ads" (Kochi / Delhi), Paytm "Product Management – Lending" (Noida / Bangalore), Fivetran "Senior Sales Engineer" (California / Germany): distinct locations, **not duplicates**.

Duplicate handling is good.

## 6. Search and filter correctness (tested via `search_opportunities_rpc` in SQL and REST)

| Test | Result | Status |
|---|---|---|
| No filters | 2,921 rows | PASS |
| `q=python` vs `q=PYTHON` | 558 / 558 | PASS (case-insensitive) |
| `q=software engineer intern` (multi-word, cross-field) | 17 rows | PASS |
| SQL-injection-like `%' or 1=1 --` | 0 rows, no error | PASS |
| `q=frontend bengaluru` / `q=frontend bangalore` | 1 / **0** | FAIL: no city synonyms (Bengaluru/Bangalore, Gurgaon/Gurugram, Bombay/Mumbai) |
| Description text search | not searched (title, location, category, company, tags only) | FAIL vs requirement |
| Mode = Remote | **289** rows, but 1,399 published rows have `is_remote = true` | **FAIL**: the filter reads the 90%-empty `mode` column |
| Mode = Hybrid | 0 (no row has Hybrid) | FAIL |
| Paid only / Free only | 16 / 1 (99% of `is_paid` is NULL) | **FAIL**: the filter silently hides 99% of listings |
| Category = Workshop | 0 (offered in the UI, never ingested) | FAIL (dead option) |
| Experience filter | returns 0 for any value; correctly **hidden** in UI (`ENABLE_EXPERIENCE_FILTER = false`) | N/A |
| Deadline filter | uses date range | PASS (SQL) |
| Pagination clamp | `page_limit` capped at 100, offset ≥ 0 | PASS |

## 7. Performance (database side)

- `search_opportunities_rpc('software engineer intern')`: **165 ms** execution for ~2.9k published rows. The dynamic SQL builds the filtered CTE twice (rows + `count(*)` subquery), uses ILIKE scans (the FTS index `idx_opportunities_fts` is **unused**), and joins tags twice. Cost grows linearly with catalogue size.
- Advisor (performance): 79 × `auth_rls_initplan` (`auth.uid()` re-evaluated per row; wrap as `(select auth.uid())`), 87 × multiple permissive policies, 15 unindexed foreign keys, 24 unused indexes.

## 8. Recommendations (database)

1. Fix the `note_shares` / `note_share_recipients` policies so the note must be owned by `auth.uid()`: `WITH CHECK (owner_id = auth.uid() AND EXISTS (select 1 from notes n where n.id = note_id and n.user_id = auth.uid()))`. **P0**
2. Delete storage objects on account deletion (server action using service role, or an `auth.users` delete hook), then purge the 6 existing orphaned files. **P0**
3. Make `note-attachments` private and serve via signed URLs; drop `image/svg+xml`. **P1**
4. Apply the missing `handle_new_user` fix; reconcile migration history with `supabase migration repair` and add the 2 missing files. **P1**
5. Map the Remote filter to `is_remote`; hide the Paid/Free, Hybrid and Workshop options until the data exists. **P1**
6. Store date-only deadlines as end-of-day Asia/Kolkata (`YYYY-MM-DDT23:59:59+05:30`). **P1**
7. Stop fabricating Amazon deadlines: store NULL and label it "No deadline published". **P1**
