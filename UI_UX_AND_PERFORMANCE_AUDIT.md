# UI/UX and Performance Audit — Opportunity Radar

Audit date: 14 Nov 2026
Environment: local **production build** (`next build && next start`, Next 16.3.8, Node 22.23) on `localhost:3000`, backed by the production Supabase project (read-only use), Chromium via Playwright.
**These are localhost measurements.** Production latency differs, notably because of the region mismatch in P-01.

## 1. Coverage

| Route group | Tested in browser? | Why |
|---|---|---|
| `/`, `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/privacy`, `/terms` | **Yes**, 7 viewports each (49 page loads) | public |
| `/dashboard`, `/search`, `/opportunities/[id]`, `/tracker`, `/assistant`, `/ai-search`, `/interview*`, `/resume*`, `/notes`, `/hub`, `/profile*`, `/settings`, `/support`, `/certifications`, `/notifications` | **BLOCKED** (redirect to `/login` verified) | signed-in only; no test account on production; no service-role / AI keys |

## 2. Responsive sweep (public routes)

Viewports: 320×568, 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080. Checks: HTTP status, horizontal overflow (`scrollWidth > innerWidth`), console errors, page errors, failed requests, images without `alt`, buttons/links without an accessible name, inputs without a label.

| Route | Overflow at any viewport | Console / page errors | Unnamed controls | Unlabelled inputs | Result |
|---|---|---|---|---|---|
| `/` | none | 0 | 0 | 0 | PASS |
| `/login` | none | 0 | 0 | 0 | PASS |
| `/signup` | none | 0 | 0 | 0 | PASS |
| `/forgot-password` | none | 0 | 0 | 0 | PASS |
| `/verify-email` | none | 0 | 0 | 0 | PASS |
| `/privacy` | none | 0 | 0 | 0 | PASS |
| `/terms` | none | 0 | 0 | 0 | PASS |

Visual review (screenshots at 320, 390 and 1440):
- **UX-01 (Low):** at 320 px the landing header wraps "Opportunity Radar" onto two lines, and the "Sign up" pill wraps its text too.
- The login/signup card is clean and readable; Google sign-in is prominent.
- The landing hero states "2,900+ Opportunities / 700+ Companies / Daily". These are correct against the database, but "Daily new opportunities" depends on ingestion runs that do not finish (see the database audit).

## 3. UX issues found by code and data review (signed-in pages)

| ID | Severity | Page | Issue |
|---|---|---|---|
| UX-02 | **High** | `/search` | **Filters lie.** "Remote" shows 289 of ~1,399 remote listings, and "Hybrid" returns 0. "Paid" shows 16 and "Free" shows 1, out of 2,921. "Workshop" is always empty. A student applying "Remote + Paid" sees ~0 results and concludes the platform is empty. |
| UX-03 | **High** | `/search`, detail | About 65% of "Jobs" are senior roles, and ~25% of sampled Internshala/Lever/Greenhouse links were already closed. Both erode trust. |
| UX-04 | High | detail, cards | Amazon listings show an **invented** "deadline in 30 days". Internshala deadlines vanish at 05:30 IST on the last day. |
| UX-05 | Medium | `/dashboard` | The "opportunities" block shows the same 6 newest listings to every user, with no personalisation from the profile skills the user filled in. |
| UX-06 | Medium | `/profile/saved`, `/tracker` | Saved items and "Saved"-stage tracker cards silently disappear when a listing expires (DB cascade). There is no "expired" state or notice. |
| UX-07 | Medium | all | The whole product, including browsing one opportunity, requires an account. Visitors cannot preview listings and links cannot be shared. Search engines cannot index opportunities. |
| UX-08 | Low | `/settings` | Toggles are `<button>`s without `role="switch"` / `aria-checked`, so screen readers cannot announce the state. "Your profile and resume stay private either way" is contradicted by Hub profile exposure (SEC-06). |
| UX-09 | Low | `/support` | Uses `support@opportunityradar.com`, and the policy uses `privacy@` / `hello@` on the same domain. Confirm that domain is owned and receiving mail; the app is served from `*.vercel.app`. |
| UX-10 | Low | `/settings` | "Email Alerts" toggle stores a preference but nothing is ever sent. The copy says so honestly; consider hiding it until delivery exists. |

## 4. Frontend performance (localhost production build)

Captured per page load: navigation time to network idle, TTFB, FCP, LCP, CLS, transferred JS/CSS, request count.

| Route | FCP (ms) | LCP (ms) | CLS (max) | JS transferred | CSS | Requests |
|---|---|---|---|---|---|---|
| `/` | 172–436 | 172–436 | 0.000 | 285 KB | 42 KB | 35 |
| `/login` | 200–252 | 200–612 | 0.044 (768 px) | 281 KB | 42 KB | 24 |
| `/signup` | 188–308 | 188–720 | 0.029 | 211 KB | 42 KB | 19 |
| `/forgot-password` | 124–148 | 176–208 | 0.042 | 285 KB | 42 KB | 30 |
| `/privacy` | 136–224 | 136–224 | 0.028 | 289 KB | 42 KB | 27 |
| `/terms` | 132–200 | 132–200 | 0.000 | 289 KB | 42 KB | 29 |
| `/verify-email` | 132–192 | 132–192 | 0.008 | 354–357 KB | 42 KB | 31–37 |

All public pages are well inside "good" Core Web Vitals thresholds locally (LCP < 2.5 s, CLS < 0.1). INP was not measured (no interaction script).

### Bundle composition (from `.next/static/chunks`)

| Chunk | Size (raw) | Dominant libraries | Loaded by |
|---|---|---|---|
| `014ie8e-…js` | **8.4 MB** | three.js, yoga (layout), react-pdf | not attributed (signed-in route; most likely résumé builder) |
| `1t9e3m7rh0j0w.js` | 1.9 MB | three.js, `@splinetool` | most likely the floating robot, mounted on **every signed-in page** |
| `21_o1g91q9o9t.js` | 1.9 MB | (unidentified vendor) | not attributed |
| `11ojei5fa3wou.js` | 1.2 MB | three.js | not attributed (the landing page transferred only 285 KB of JS, so it is not loaded up front there) |

Per-route attribution of these chunks needs a signed-in session or `@next/bundle-analyzer`; this is **NOT VERIFIED**.
| `1ey6jff8ogj0x.js` | 624 KB | livekit | interview |
| `14ig6h3jyf7cn.js` | 476 KB | pdfjs | résumé preview |
| `3subh5lzx4u4b.js` | 463 KB | tiptap | notes |

Total client chunks: 75 files, 19 MB raw. `public/` is **13 MB** and includes 600 KB–1.1 MB PNGs (`global_chat.png` 1.1 MB, `resume_optimizer.png` 732 KB …) and template JPG/PDF samples.

## 5. Backend / API performance

### Supabase search RPC, measured from this sandbox (20 samples each, includes network RTT)

| Query | p50 | p95 | min | max | Payload |
|---|---|---|---|---|---|
| default page | 885 ms | 1,175 ms | 440 ms | 2,408 ms | 16 KB |
| `q=python` | 945 ms | 1,005 ms | 511 ms | 1,028 ms | 16 KB |
| `q=software engineer intern` | 923 ms | 980 ms | 498 ms | 1,006 ms | 14 KB |
| category + deadline sort | 815 ms | 890 ms | 385 ms | 929 ms | 16 KB |
| tags filter | 860 ms | 929 ms | 438 ms | 930 ms | 17 KB |
| deep page (offset 2800) | 816 ms | 907 ms | 412 ms | 942 ms | 12 KB |
| `landing_stats` (10 samples) | 736 ms | — | — | 788 ms | — |

**Database execution time** (`EXPLAIN ANALYZE`) of the multi-word search: **165 ms**. The rest is network.

### AI routes (production telemetry, not measured locally)

The assistant replies in 2–4 s when healthy. It took 45 s and then failed when all providers failed. ATS JD extraction 6.5–124 s, evidence evaluation 12–40 s, parsing 3–64 s. See the AI audit.

## 6. Bottlenecks and recommendations

| ID | Bottleneck | Evidence | Recommendation | Impact | Effort |
|---|---|---|---|---|---|
| P-01 | **Function region ≠ database region.** Vercel functions run in `iad1` (US East); Supabase is in `ap-south-1` (Mumbai). Every server render and API call crosses ~200+ ms RTT, several times per page (layout `getUser` + page queries). | live header `x-vercel-id: iad1::iad1`; Supabase region | Set `"regions": ["bom1"]` in `vercel.json` (Mumbai). This also suits India-first users. | **High**: likely saves hundreds of ms per signed-in page | XS |
| P-02 | Search RPC double-evaluates the CTE (rows + `count(*)`), ILIKE scans, tag joins; FTS index unused | 165 ms at 2.9k rows; advisor `unused_index idx_opportunities_fts` | Use `count(*) over()` in one pass; adopt `fts` / `pg_trgm` GIN indexes for ILIKE | Medium (grows with catalogue) | M |
| P-03 | RLS `auth.uid()` re-evaluated per row (79 policies) | Supabase advisor `auth_rls_initplan` | Rewrite as `(select auth.uid())` | Medium at scale | S |
| P-04 | 3-D robot loads three.js and Spline on every signed-in page | chunk analysis; `app/(protected)/layout.tsx:52` | Load on first interaction or idle, respect `prefers-reduced-motion`, skip on mobile/low-end | Medium (≈2 MB+ per session, battery) | S |
| P-05 | Large PNGs in `public/` | 13 MB public | Convert to WebP/AVIF via `next/image`; drop unused template samples | Low–Medium | S |
| P-06 | AI latency outliers on Gemini | telemetry | Put the fast provider first for ATS/parse; cap per-call time lower; stream assistant responses | High for UX | M |
| P-07 | 15 unindexed FKs, 24 unused indexes | advisor | Add/remove indexes | Low now | S |

## 7. Accessibility summary

Public pages passed the automated name/label/alt checks. Not covered: colour-contrast measurement, keyboard-only navigation of signed-in pages, focus trapping in modals, and screen-reader runs. These are **NOT TESTED** and need a manual or axe pass once a test account exists.
