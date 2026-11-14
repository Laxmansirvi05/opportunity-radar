# Production Readiness Roadmap — Opportunity Radar

Audit date: 14 Nov 2026 · Status: **proposal, awaiting approval.** No code, data or configuration has been changed.

Effort scale: XS < 1 h · S ≤ ½ day · M 1–2 days · L 3–5 days · XL > 1 week.

## 1. Prioritised remediation plan

| ID | Issue | Severity | Feature | Proposed fix | Priority | Effort | Dependencies |
|---|---|---|---|---|---|---|---|
| R-01 | Next.js 16.3.8 has unauthenticated RCE advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr) | Critical | Platform | Upgrade `next` + `eslint-config-next` to 16.4.6; re-run type-check, tests and build | **P0** | S | — |
| R-02 | Any user can publicly share another user's note (`note_shares` RLS) | High | Notes | New migration: `WITH CHECK (owner_id = auth.uid() AND EXISTS(select 1 from notes where id = note_id and user_id = auth.uid()))`; same for UPDATE | **P0** | S | Staging DB for testing |
| R-03 | Cross-account read/edit via `note_share_recipients` | High | Notes | Same ownership check; add RLS integration tests | **P0** | S | R-02 |
| R-04 | Account deletion leaves résumés, avatars and Hub images in storage (6 orphaned objects exist) | High | Account / Privacy | Server action: list and remove objects under `<uid>/` in all buckets with the service role **before** `delete_user`; one-off purge of existing orphans (**needs approval**) | **P0** | M | — |
| R-05 | Vulnerable deps: dompurify (critical), undici, zod, sanitize-html | High | Platform | Remove unused `dompurify`; bump `cheerio`/`undici` ≥ 7.30.1, `zod` ≥ 4.6.6, `sanitize-html` patch | **P0** | S | R-01 |
| R-06 | Hub profile leaks email and other fields; ignores `public_profile` | Medium | Hub / Privacy | Drop `email` from `getPublicProfile`; return extended fields only when the user opts in; align settings and privacy copy | **P1** | S | — |
| R-07 | `note-attachments` bucket public with permanent URLs; SVG allowed | Medium | Notes | Make bucket private, serve signed URLs, disallow SVG; migrate the existing row | **P1** | M | — |
| R-08 | Amazon deadlines fabricated (now + 30 days) on 819 listings | High (trust) | Discovery | Set `deadline: null`; show "No deadline published"; backfill NULL on existing Amazon rows (**needs approval**) | **P1** | S | — |
| R-09 | Date-only deadlines stored as 00:00 UTC, so listings vanish at 05:30 IST on the last day | High (trust) | Discovery | Parse date-only values as `23:59:59+05:30`; add a unit test; backfill (+18h29m59s) rows at 00:00 UTC from Internshala/Unstop (**needs approval**) | **P1** | S | — |
| R-10 | ~25% of sampled Internshala/Lever/Greenhouse listings are closed yet marked `link_status=200` | High (trust) | Discovery | Link sweep: Lever via `api.lever.co/v0/postings/<co>/<id>` (404 = closed), Greenhouse via `boards-api` (404 = closed), Internshala via `isInternshipClosed()` on the detail page; expire on closed | **P1** | M | — |
| R-11 | Ingestion runs time out before logging and reconciling; Lever stale since 2 Nov; 1,524 listings unseen > 7 days | High | Ingestion | Split each source into its own short cron or batch (per board / per page); log at start and per batch; reconcile per source; alert on "no successful run in 36 h" | **P1** | L | Decide queue vs. split (see `QueueProducerService`) |
| R-12 | Search filters broken: Remote reads the empty `mode` column; Paid/Free 99% NULL; Hybrid and Workshop empty | High (UX) | Search | Map Remote to `is_remote`; derive `mode` at ingestion; hide Paid/Free, Hybrid and Workshop until data exists; add a "filter returns ≥ 1 row" test | **P1** | S | — |
| R-13 | 65% of "Jobs" are senior roles | High (relevance) | Discovery | At ingestion: classify seniority from title/description; default the student feed to entry/intern/new-grad; move senior roles behind a toggle or drop them | **P1** | M | — |
| R-14 | Bookmarks and "Saved" tracker cards silently deleted when a listing expires | Medium | Tracker | Soft-expire (keep row, status Expired) for any opportunity referenced by bookmarks/tracker; delete only unreferenced rows | **P1** | M | — |
| R-15 | Unapplied migration (`handle_new_user` ignores `full_name`); migration history drift (18 + 2) | Medium | DB | Apply the fix; `supabase migration repair` to align history; commit the 2 missing remote migrations; verify `db reset` reproduces prod on a staging project | **P1** | M | Staging project |
| R-16 | Function region `iad1` vs DB `ap-south-1` | Medium (perf) | Platform | `vercel.json`: `"regions": ["bom1"]` | **P1** | XS | Deployment (separate approval) |
| R-17 | Privacy policy inaccurate (providers, Hub visibility, deletion); no DPDP grievance contact | Medium (legal) | Legal | Update the policy after R-04/R-06; add Cloudflare/Ollama and external agents as processors; legal review for DPDP Act 2023 | **P1** | S + legal | R-04, R-06 |
| R-18 | AI not used or verified since 9 Oct; keys and quotas unknown | Medium | AI | Run the AI evaluation plan (`AI_FEATURE_AUDIT.md` §6) on localhost with keys; add a daily synthetic health check (`/api/cron/health` into `vercel.json`) | **P1** | M | Keys |
| R-19 | Dashboard not personalised; recommendation engine unused | Medium (value) | Dashboard | Wire `lib/recommendation-engine` into the dashboard with profile skills, city and graduation year | **P2** | M | R-12, R-13 |
| R-20 | Competitions/scholarships under-supplied; `UnstopCompetitionsProvider` unwired | Medium (value) | Ingestion | Wire the provider into a cron; add scholarship sources (e.g. government portals) | **P2** | M | R-11 |
| R-21 | AI rate limiter fails open and races | Medium | AI | Fail closed on RPC error; reserve a usage row atomically before the call | **P2** | S | — |
| R-22 | ATS latency 40–124 s; 8B-model fallbacks for parsing/coaching | Medium | AI | Reorder providers (fast first), lower per-call caps, stream progress; exclude 8B from parsing | **P2** | M | R-18 |
| R-23 | ATS score shown without "estimate" disclaimer | Low | ATS | Add explanatory copy and methodology link | **P2** | XS | — |
| R-24 | Search: no city synonyms; description not searchable; 165 ms DB time | Medium | Search | Synonym table (Bengaluru/Bangalore …); use FTS (`fts` column exists) + trigram; `count(*) over()` | **P2** | M | — |
| R-25 | RLS initplan (79), permissive overlap (87), unindexed FKs (15) | Low (perf) | DB | Rewrite policies with `(select auth.uid())`; merge policies; add FK indexes | **P2** | M | R-15 |
| R-26 | 3-D robot loads three.js/Spline on every signed-in page | Low (perf) | UI | Load on interaction/idle; skip on mobile and `prefers-reduced-motion` | **P2** | S | — |
| R-27 | Orphaned API routes (`/api/ats/analyze`, `/api/resume/optimize`, `save`, `upload`) | Medium (surface) | API | Delete after owner confirmation | **P2** | S | Approval |
| R-28 | 55 never-run test files; e2e has no signed-in coverage; CI lacks build/audit | Medium | Testing | Fix vitest `include`; add staging-based authenticated e2e; add `next build` + `npm audit` to CI | **P2** | M | Staging project |
| R-29 | Dead code (~120 files, 4.5 MB unused PDFs, 10 deps) | Low | Code quality | Execute the approved items from `DEAD_CODE_AND_CLEANUP_CANDIDATES.md` | **P3** | M | Approval |
| R-30 | Vendored Reactive Resume code without licence notice | Low (legal) | Compliance | Add the upstream LICENSE/NOTICE to `frontend/packages/` | **P3** | XS | — |
| R-31 | Weak password policy (6 chars), leaked-password protection off | Low | Auth | Min 8–10 chars; enable HIBP check in Supabase Auth | **P3** | XS | — |
| R-32 | `metadataBase` unset, `X-Powered-By` header, `get_user_role` anon-exec, `ingestion_logs` readable, hub cursor filter not sanitised | Low | Platform | Small fixes | **P3** | S | — |
| R-33 | Mobile header wraps at 320 px; settings toggles lack `role="switch"` | Low | UI | CSS + ARIA | **P3** | XS | — |
| R-34 | All discovery requires login (no public listing pages) | Product | Growth | Consider public, indexable opportunity pages (read-only, anon RLS already allows it) | **P3** | M | Product decision |
| R-35 | Support/privacy emails on `opportunityradar.com` | Low | Support | Confirm the domain is owned and receiving mail | **P3** | XS | — |

## 2. Staged execution plan

### Stage A: critical fixes (≈ 3–4 days)
R-01, R-05 (dependency upgrades) → R-02, R-03 (RLS) → R-04 (storage deletion and orphan purge) → R-06, R-07 (privacy exposure) → R-08, R-09 (deadline truth).
*Exit criteria:* `npm audit --omit=dev` shows 0 high/critical. Rolled-back RLS probes from `SECURITY_AUDIT.md` are denied. Zero orphaned storage objects. No synthesised deadlines.

### Stage B: core functionality (≈ 1 week)
R-12 (filters), R-14 (soft-expire saved items), R-18 (AI verification), R-21, R-22, R-23, R-19 (personalised dashboard).
*Exit criteria:* every visible filter option returns plausible counts. All AI features pass the evaluation script with keys. The dashboard differs per profile.

### Stage C: data reliability (≈ 1–2 weeks)
R-11 (ingestion that completes and logs), R-10 (closed-listing detection), R-13 (seniority), R-20 (competitions/scholarships), R-15 (migration hygiene).
*Exit criteria:* every provider has a SUCCESS log within 26 h. Fewer than 5% closed links in a fresh 150-link sample. At least 70% of "Jobs" are entry-level or internship-appropriate.

### Stage D: performance (≈ 3–4 days)
R-16 (region; needs a deployment, done in the deployment phase), R-24, R-25, R-26, image compression.
*Exit criteria:* search DB time < 50 ms. Signed-in page TTFB measured from India < 500 ms.

### Stage E: code cleanup (≈ 2–3 days, after approval)
R-27, R-29, R-30, R-28 (test hygiene), R-31 … R-33.

### Stage F: final localhost verification
Re-run: `npm ci`, type-check, lint, unit tests, `next build`, the responsive sweep, the 150-link sample, the search-filter SQL checks, and the RLS probes. Update each audit document with final status. **Only then** begin a separate deployment-readiness audit (which includes R-16).

## 3. Items requiring explicit approval before execution

- Any write to the production database: orphan-storage purge (R-04), deadline backfills (R-08, R-09), `migration repair` (R-15).
- Any deletion of files (R-27, R-29) or features.
- Any deployment or Vercel configuration change (R-16).
- Creating test accounts. Recommendation: use a separate **staging** Supabase project, never production.

## 4. Environment notes for the next session

The audit created a personal cloud environment named **`opportunity-radar`**. It allows these hosts: the project's Supabase API, the live site, Internshala, Unstop, Greenhouse, Lever, Amazon Jobs, SmartRecruiters and YC. No environment variables or secrets were stored.
