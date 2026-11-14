# Security Audit — Opportunity Radar

Audit date: 14 Nov 2026 · Scope: repo at `d9d74e0` (identical to production), local production build, read-only production database inspection.
Rules followed: no secrets printed, no attacks on production or third parties. All database write tests were in transactions that always rolled back, and no live endpoint was exploited.

> Passing scans do not make an application secure. This report covers what was examined; anything marked NOT TESTED was not.

## Severity summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | SEC-01 |
| High | 4 | SEC-02, SEC-03, SEC-04, SEC-05 |
| Medium | 6 | SEC-06 … SEC-11 |
| Low | 7 | SEC-12 … SEC-18 |

## Findings

### SEC-01 — Critical — Next.js 16.3.8 has two unauthenticated RCE advisories
- `npm audit --omit=dev` reports `next` (range 16.0.0–16.4.0) as affected by **GHSA-2464-fhr4-w9xw** (RCE in the Image Optimization API when SVG files are used) and **GHSA-673q-mjm6-r5xr** (RCE in `use cache` functions returning typed arrays), plus **GHSA-p3m5-59mp-jv5r** (server-action DoS).
- The app's preconditions line up with the first advisory: `next.config.ts` allows `images.remotePatterns` for `*.supabase.co`, and the **public** `note-attachments` bucket accepts `image/svg+xml` uploads from any signed-in user.
- **Not exploited. The live `/_next/image` endpoint was not probed.**
- Fix: `next@16.4.6` (npm reports it as non-major), along with `eslint-config-next`. **P0.**

### SEC-02 — High — Any user can publish another user's note to the internet (`note_shares` RLS)
- The `note_shares_owner_all` policy only checks `owner_id = auth.uid()`; it never checks that `note_id` belongs to the caller.
- Rolled-back test: as user A, `INSERT INTO note_shares(note_id=<B's note>, owner_id=A, slug=…, link_access='view')` **succeeded**.
- `/notes/shared/[slug]` reads through the **service-role** client and checks only `link_access='view'`, so B's private note would be served publicly.
- The API route `app/api/notes/[id]/share` does check ownership. However, PostgREST is directly reachable with the public anon key plus the user's JWT, so the API check is not a boundary.
- Precondition: the victim note's UUID (v4). Fix: add an ownership `EXISTS` check to `WITH CHECK`. **P0.**

### SEC-03 — High — Cross-account read/edit of notes (`note_share_recipients` RLS)
- Same missing ownership check. Rolled-back test: A inserts `(note_id=<B's note>, owner_id=A, recipient_id=C, permission='edit')`. C's visible count of B's note went **0 → 1**, and C can then update it via `notes_update_shared_with_me`. **P0.**

### SEC-04 — High — Account deletion leaves personal files behind
- `deleteAccountAction` → `rpc('delete_user')` deletes `auth.users`. Database rows cascade, but **storage objects do not**.
- Live evidence: 3 of 6 résumé PDFs, 2 of 3 Hub images (public bucket) and 1 avatar belong to user IDs that no longer exist.
- This contradicts the privacy policy ("permanently erases your profile, saved resumes …"). It is a data-protection exposure under India's DPDP Act 2023 (legal review recommended). **P0.**

### SEC-05 — High — Vulnerable production dependencies besides Next
`npm audit --omit=dev`: 2 critical, 2 high, 1 moderate, 1 low.

| Package | Installed | Advisory | Fix |
|---|---|---|---|
| dompurify | 3.4.16 | GHSA-cg2g-xh64-v4q7 (critical), GHSA-mrv2-3pqr-j5jr (high) | >3.4.16 |
| undici | 7.30.0 (via cheerio) | 8 advisories incl. TLS validation bypass GHSA-2m5v-pch6-74hx | 7.30.1 |
| zod | <4.6.6 | GHSA-mrhx-c7xc-m3w5 memory exhaustion | 4.6.6 |
| sanitize-html | 2.17.x | unbounded recursion | patch |
| deepmerge | — | prototype poisoning (low) | patch |

knip also reports `dompurify` as unused, so removal is an option. Full tree (including dev): 34 vulnerabilities (3 critical, 12 high); the dev-only ones (vitest, happy-dom, shadcn …) do not ship.

### SEC-06 — Medium — Hub profile lookup discloses email and more to any signed-in user
- The `getPublicProfile` server action (service role) returns `email, name, avatar, bio, university, degree, graduation_year, skills, linkedin_url, github_url` and achievements for **anyone who has ever posted in the Hub**. It ignores the `public_profile` flag.
- The privacy policy says only display name, photo and posts are visible in the Hub. Settings says "Your profile and resume stay private either way."

### SEC-07 — Medium — Private note attachments are public and permanent
- The `note-attachments` bucket is `public = true`, and uploads return `getPublicUrl` links that never expire and survive note deletion. SVG is permitted (also see SEC-01).

### SEC-08 — Medium — AI rate limiter fails open and is racy
- `checkRateLimit` (`lib/ai-gateway/index.ts`) allows the call when the `check_ai_rate_limit` RPC errors. Its in-memory fallback is per-serverless-instance. Usage is logged only **after** the call, so N parallel requests all pass the check (TOCTOU). Cost-abuse risk on AI features.

### SEC-09 — Medium — Orphaned AI-capable endpoints remain deployed
- `/api/resume/optimize` (calls the AI gateway), `/api/ats/analyze`, `/api/resume/save` and `/api/resume/upload` have **no caller** in the frontend, but remain authenticated attack and cost surface. See DEAD_CODE_AND_CLEANUP_CANDIDATES.md.

### SEC-10 — Medium — Migration drift hides the real security posture
- Production policies and grants cannot be reproduced from the repo (18 unrecorded migrations, 2 missing files). Security reviews of the repo do not equal production. See the database audit.

### SEC-11 — Medium — Destructive data policy
- The ingestion reconciler **hard-deletes** opportunities after their deadline or once unseen. `ON DELETE CASCADE` then deletes the user's **bookmarks**, **recently viewed** and **"Saved" tracker rows (including the user's notes on them)** without notice. Applied/Interview/Selected/Rejected rows are protected. This is product-intended per `lib/ingestion/reconciliation.ts`, but it destroys user-authored data silently.

### Low

| ID | Finding |
|---|---|
| SEC-12 | `get_user_role()` SECURITY DEFINER is executable by `anon` (returns NULL; advisor WARN). |
| SEC-13 | `ingestion_logs` is readable by all signed-in users. |
| SEC-14 | Weak password policy: Supabase "leaked password protection" is off. Both `config.toml` (`minimum_password_length = 6`) and the app (`lib/auth/credentials.ts: MIN_PASSWORD_LENGTH = 6`) require only 6 characters, with no complexity rule. Production Auth settings beyond the advisor output were NOT TESTED. |
| SEC-15 | Hub pagination cursors (`before_created_at`, `before_id`) are interpolated unsanitized into a PostgREST `.or()` filter (`app/api/hub/messages/route.ts`). Data is readable by the caller anyway, so impact is low, but this is the same filter-injection class fixed elsewhere with `sanitizeFilterTerm`. |
| SEC-16 | `X-Powered-By: Next.js` header is exposed (`poweredByHeader: false` is not set). |
| SEC-17 | CSP keeps `'unsafe-inline'` for scripts (documented trade-off in `next.config.ts`); `img-src https:` is broad. |
| SEC-18 | Assistant prompt joins history as `User:` / `Assistant:` text, so a user can forge "Assistant:" turns. Impact is limited to their own session; no tools or secrets are reachable from that prompt. |

## Checks that passed (with evidence)

| Area | Result |
|---|---|
| Secrets in git history (371 commits) | None found (pattern scan; see the git audit) |
| Secrets in current tree | None hardcoded; only test fixtures |
| Client bundle exposure | Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are referenced; `grep` of `.next/static` for service-role/AI key names returned 0 files |
| Cron auth | `denyIfNotCron` fails closed: no secret → 503; `Bearer undefined` → 503 (tested locally); constant-time compare |
| Unauthenticated API access | `/api/assistant`, `/api/notes`, `/api/resume/list` → 401 (tested); protected pages → 307 to `/login?next=…` (tested) |
| Open redirect | `safeNextPath` on callback; unit-tested; `/auth/callback?error=<script>` only reflects into a URL-encoded query string rendered by React (escaped) |
| Privilege escalation via profile | Blocked by the `protect_profile_fields` trigger |
| Scraped-description XSS | `sanitizeAndFormatDescription` ends with a `sanitize-html` allowlist (`h3[class]` only). Probe `<img src=x onerror=… data-x=Responsibilities:` → `onerror` removed (PASS, temporary local test, deleted afterwards) |
| Shared-note XSS | Content re-sanitised on render (`sanitizeNoteContent`) |
| Security headers | CSP, HSTS (preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present locally and live |
| Service-role usage | Confined to server routes, cron, server actions and providers (27 files); none in client components |
| AI key logging | Gateway logs only the **last 4 characters** of the key (`keyFingerprint`), which is acceptable; OpenRouter error text redacts `sk-or-v1-…` |

## API key / integration validation

| Integration | Env var present here? | Connectivity test | Status |
|---|---|---|---|
| Supabase (anon) | Supplied in-session from the Supabase connector (public key) | `landing_stats` RPC → 200 | **PASS** |
| Supabase (service role) | No | — | **BLOCKED** (not provided; intentionally not requested) |
| Gemini / Groq / OpenRouter / Mistral / Cloudflare / Ollama | No | — | **BLOCKED**. Production telemetry (`ai_usage_log`) shows successful Gemini, OpenRouter and Cloudflare calls up to 9 Oct 2026, and none since. |
| Google OAuth | n/a | Requires interactive Google consent | **BLOCKED** |
| Cloudflare Turnstile | No | — | BLOCKED (widget absent locally, by design when unset) |
| LiveKit / DeepInterview agent | No | — | **BLOCKED** |
| AI Search agent (`AI_AGENT_URL`) | No | — | **BLOCKED** (last production job 9 Oct, status complete) |
| CRON_SECRET | No | refusal path tested | PASS (fail-closed) |

## Not tested

- Production Supabase Auth settings (email confirmation, OTP expiry, rate limits, redirect allow-list) beyond the advisor output.
- Authenticated end-to-end IDOR tests through the HTTP API (no test accounts were created on production; RLS was tested directly instead).
- Upload validation with real files (`lib/upload-signature.ts` is unit-tested in `tests/upload-signature.test.ts`).
- SSRF: the link checker and providers fetch only hardcoded or registry hosts. A review found no user-controlled URL fetch, but this was not fuzzed.
