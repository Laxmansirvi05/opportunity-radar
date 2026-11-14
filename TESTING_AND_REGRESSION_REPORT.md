# Testing and Regression Report — Opportunity Radar

Audit date: 14 Nov 2026 · Commit `d9d74e0` · Node v22.23.4, npm 10.9.9.

## 1. Commands executed and results

| # | Command (in `frontend/`) | Result | Time |
|---|---|---|---|
| 1 | `npm ci --no-audit --no-fund` | **PASS**: 1,150 packages; 2 deprecation warnings (`whatwg-encoding`, `node-domexception`) | 37 s |
| 2 | `npm run type-check` (`tsc --noEmit`) | **PASS**: 0 errors | 24 s |
| 3 | `npm run lint` | **PASS**: 0 errors, **131 warnings** (mostly `no-explicit-any`, unused vars in tests) | 23 s |
| 4 | `npm test` (vitest) | **PASS**: 81 files, **730 / 730 tests** | 8.7 s |
| 5 | `npm run build` **without env vars** | FAIL (environmental): prerender of `/tracker` threw "Missing Supabase environment variables" | 1 m 40 s |
| 6 | `npm run build` with public Supabase URL + anon key | **PASS**: 68 static pages, 54 API routes, middleware; warning: `metadataBase` not set | ~70 s compile |
| 7 | `next start -p 3000` + HTTP smoke (17 routes) | **PASS** (see section 3) | — |
| 8 | `npx playwright test` (project config) | FAIL (environmental): bundled browser revision missing for `@playwright/test@1.62` | — |
| 9 | Same suite with the pre-installed Chromium (temp config outside repo) | **PASS: 4 / 4**, but signed-out paths only (section 4) | 2.3 s |
| 10 | Playwright responsive + Web Vitals sweep (49 loads) | **PASS** (see the UI audit) | ~1 min |
| 11 | `npm audit --omit=dev` | **FAIL**: 2 critical, 2 high, 1 moderate, 1 low | — |
| 12 | `npx knip@5.66.0` | 145 unused files, 10 unused deps, 72 unused exports (see dead-code report) | — |

Build warning: `metadataBase` is not set, so Open Graph/Twitter image URLs resolve to `http://localhost:3000`. That is wrong in production (Low).

## 2. What the existing tests actually cover

- **730 unit tests across 81 files, all in `tests/` (80 files) plus 1 in `features/`.** They are strong on: AI gateway routing, rate limits, key rotation, ATS v2 scoring and hallucination guard, résumé fabrication guard, cron auth, ingestion status/kill-switch, link checker, reconciliation, notes API, tracker actions, safe-next-path, upload signatures, storage-policy SQL text.
- **Coverage gaps:**
  - **55 `*.test.ts` files under `features/`, `libs/`, `packages/`, `lib/` never run.** The vitest `include` is `tests/**/*.test.ts`, `features/**/*.test.tsx` and `libs/**/*.test.tsx`; `.ts` tests outside `tests/` are not matched. Five more `.test.tsx` files are explicitly excluded (Lingui macro limitation). The `packages/*/vitest.config.ts` files are never invoked by any npm script.
  - **No RLS integration tests** against a real Postgres. `tests/storage-policies.test.ts` checks SQL text, not behaviour. That is why SEC-02/03 (note-sharing RLS) were not caught.
  - No test asserts that a search filter returns a non-trivial share of the catalogue, which would have caught the Remote/Paid filter failures.
  - No test of deadline timezone semantics (date-only → IST end of day).
  - No test that providers never synthesise deadlines (`AmazonProvider` does).
- **E2E (`e2e/`, 3 specs, 4 tests)** are written to pass when the visitor is redirected to `/login`. With no test account they assert only "redirects to login". The ATS "real flow" spec never uploads a résumé in CI. **They give no signed-in coverage.**
- **CI** (`.github/workflows/ci.yml`) runs `npm ci`, type-check, unit tests and lint. It does **not** run `next build`, e2e or `npm audit`.

## 3. Executed functional checks (this audit)

| ID | Description | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| T-01 | Landing renders with live stats | GET `/` | 200, stats from DB | 200; "2,900+ / 700+" = RPC 2,921 / 715 | PASS | curl + screenshot |
| T-02 | Protected route redirect | GET `/search`, `/dashboard`, `/tracker` signed out | 307 → `/login?next=` | 307 with `next` preserved | PASS | curl |
| T-03 | Unauth API rejected | POST `/api/assistant`; GET `/api/notes`, `/api/resume/list` | 401 | 401 ×3 | PASS | curl |
| T-04 | Cron fails closed | GET `/api/cron/maintenance` with `Bearer undefined`, no secret set | 503 | 503 "Cron is not configured" | PASS | curl |
| T-05 | OAuth callback without code | GET `/auth/callback` | redirect with error | `/login?error=Invalid authentication callback` | PASS | curl |
| T-06 | Callback error reflection | `/auth/callback?error=x&error_description=<script>` | encoded, not executed | URL-encoded `%3Cscript%3E` | PASS | curl |
| T-07 | Unknown route | GET `/nonexistent` | 404 | 404 | PASS | curl |
| T-08 | Search: case-insensitive | RPC `python` vs `PYTHON` | equal | 558 / 558 | PASS | SQL |
| T-09 | Search: multi-word cross-field | RPC `software engineer intern` | >0 | 17 | PASS | SQL |
| T-10 | Search: injection | RPC `%' or 1=1 --` | no error, 0 rows | 0 rows | PASS | SQL |
| T-11 | Search: city synonym | `frontend bangalore` vs `bengaluru` | similar | 0 vs 1 | **FAIL** | SQL |
| T-12 | Filter: Remote | `filter_mode=[Remote]` | ≈ rows with `is_remote` (1,399) | 289 | **FAIL** | SQL |
| T-13 | Filter: Paid | `filter_is_paid=true` | majority of paid listings | 16 of 2,921 | **FAIL** | SQL |
| T-14 | Filter: Workshop | `filter_category=[Workshop]` | >0 | 0 | **FAIL** | SQL |
| T-15 | Pagination clamp | limit > 100 / negative offset | clamped | clamped in RPC code | PASS | function def |
| T-16 | Description XSS | `<img … onerror=… data-x=Responsibilities:` | handler removed | removed | PASS | temp vitest probe (deleted) |
| T-17 | Note-share ownership (RLS) | as A, share B's note | denied | **allowed** | **FAIL** | rolled-back SQL |
| T-18 | Note-recipient isolation (RLS) | A grants C on B's note | denied | **C sees B's note** | **FAIL** | rolled-back SQL |
| T-19 | Profile role escalation | (trigger review) | role locked | `protect_profile_fields` resets role | PASS | function def |
| T-20 | Deletion removes files | compare storage owners to `auth.users` | 0 orphans | 6 orphaned objects | **FAIL** | SQL |
| T-21 | Deadline realism | Amazon deadlines | NULL or real | always now + 30 days | **FAIL** | `AmazonProvider.ts:104` |
| T-22 | Listing freshness | sample 150 links | closed listings hidden | 20 closed, all marked 200 | **FAIL** | link check |
| T-23 | Public responsive layout | 7 routes × 7 viewports | no overflow or errors | none | PASS | Playwright |

## 4. Required scenario matrix (20 critical workflows)

| TC | Workflow | Preconditions | Status | Reason / related issue |
|---|---|---|---|---|
| TC-01 | Registration + login | test account | **BLOCKED** | No test accounts created on production (would write to live `auth.users`); the app routes signups through `/verify-email`, but production's confirmation setting was not checked |
| TC-02 | Google authentication | Google test account, localhost redirect allow-listed | **BLOCKED** | Interactive consent; verify `http://localhost:3000/auth/callback` is in Supabase Auth redirect URLs |
| TC-03 | Profile update | signed in | BLOCKED | — (trigger behaviour verified, T-19) |
| TC-04 | Opportunity discovery | — | PARTIAL | Data layer tested (sections 3/5 of the DB audit); UI blocked by auth |
| TC-05 | Standard search | — | PARTIAL | T-08 … T-11 |
| TC-06 | Search filters | — | **FAIL** | T-12 … T-14 |
| TC-07 | AI search | agent + keys | BLOCKED | External agent |
| TC-08 | Bookmarking | signed in | BLOCKED | RLS reviewed OK; cascade-deletion issue |
| TC-09 | Application tracking | signed in | BLOCKED | Unit tests pass (`tests/tracker-*.test.ts`) |
| TC-10 | AI assistant | keys | BLOCKED | — |
| TC-11 | AI interview | DeepInterview + LiveKit | BLOCKED | 0 sessions ever in prod |
| TC-12 | Résumé upload | signed in + keys | BLOCKED | — |
| TC-13 | Résumé parsing | keys | BLOCKED | unit tests pass |
| TC-14 | Résumé editing | signed in | BLOCKED | — |
| TC-15 | ATS scoring | keys | BLOCKED | unit tests pass |
| TC-16 | Résumé optimisation | keys | BLOCKED | fabrication guard unit tests pass |
| TC-17 | Deadline calculations | — | **FAIL** | T-21, IST timezone loss |
| TC-18 | DB access control | — | **FAIL** | T-17, T-18 |
| TC-19 | Logout / session | signed in | BLOCKED | — |
| TC-20 | Error recovery | — | PARTIAL | API 401/503 paths PASS; AI failure path: telemetry shows clean 503 after 45 s |

**Totals for this audit's executed checks (section 3):** 23 executed: 14 PASS, 9 FAIL. Scenario matrix: 0 PASS, 3 FAIL, 4 PARTIAL, 13 BLOCKED.

## 5. Recommended new regression tests

1. **RLS behaviour tests** against `supabase start` (local Docker): two users; assert cross-user `note_shares` / `note_share_recipients` inserts fail; assert all `user_id` tables are isolated.
2. **Search filter sanity:** with seeded data, Remote returns rows with `is_remote=true`; each offered filter value returns ≥ 1 row or is hidden.
3. **Deadline parsing:** `"14 Nov '26"` → `2026-11-14T18:29:59Z` (23:59:59 IST).
4. **Provider contract:** no provider may emit a deadline it did not read from the source.
5. **Account deletion:** after `deleteAccount`, no `storage.objects` remain under the user's prefix.
6. **Fix the vitest `include`** so the 55 orphaned `*.test.ts` files run (or delete them with the dead code), and run `packages/*` tests in CI.
7. **Signed-in e2e:** use a dedicated *staging* Supabase project with seeded test users (never production) and Playwright `storageState` to cover TC-01…TC-19.
8. Add `next build` and `npm audit --omit=dev --audit-level=high` to CI.
