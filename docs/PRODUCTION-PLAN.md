# Production Plan — Opportunity Radar

**Date:** 2026-08-09 · **Branch:** `restore-june19` (production) · **Live:** opportunity-radar-six.vercel.app

Where the product actually is, what must be true before real students use it,
and what it will cost to run.

---

## 0. Honest position

The product works. Auth, search (4,103 live opportunities from 82 official
employer boards plus Unstop), tracker, resume toolkit and the AI assistant are
functional and deployed. AI Search and Certifications are built and deployed but
**inert** — both need a migration, and AI Search additionally needs its agent
hosted somewhere Vercel can reach.

Three things separate "works" from "can be handed to students": the nightly
refresh does not finish, two input-validation holes are open, and there is no
way to know when something breaks in production.

---

## 1. Blockers — do not launch without these

### B1. Apply the two pending migrations · 5 min

```bash
cd "/Users/laxmansirvi/Opportunity radar" && npx supabase db push
```

`certifications` and `ai_search_jobs`. Until then `/certifications` renders
empty and `/ai-search` fails on submit.

### B2. Host the AI agent · ~half a day

The agent runs on `localhost:4300`. **Vercel cannot reach a laptop.** AI Search
is dead in production until job-server has a public URL.

It is six moving parts (Postgres, ai-gateway :4000, search-planner :4200,
render-service :3100, job-server :4300, plus n8n as a CLI executor), and
render-service ships Chromium. That rules out most serverless hosts.

**Recommended: one VPS running the existing `docker-compose.yml`.**
Hetzner CX22 or DigitalOcean 4 GB, ~$20–25/month. It matches how the system is
already built, keeps all six services on one private network, and gives
render-service the disk and memory Chromium needs.

Then in Vercel: `AI_AGENT_URL=https://agent.yourdomain.com`.

Two hardening steps at the same time:
- **Do not expose job-server to the open internet.** It has no authentication
  of its own and its guide says so plainly: *"anyone holding a job_id can read
  that job."* Put it behind a shared secret header or an IP allowlist for
  Vercel's egress.
- Keep CORS off. Only our backend calls it.

### B3. Fix the two auth bypasses · 30 min

`app/api/resume/parse/route.ts:25` and `app/api/resume/ats-check/route.ts:25`:

```ts
if (!user && process.env.NODE_ENV === 'production') {
```

Unauthenticated callers are allowed whenever `NODE_ENV !== 'production'`, and
the fallback user id `'dev-test-user'` also sidesteps per-user AI rate limits.
Any preview deployment is an open, unmetered door to your AI spend. Require auth
unconditionally.

### B4. Fix the PostgREST filter injection · 2 hours

`features/opportunities/services/opportunity-service.ts:254` and
`app/api/assistant/route.ts:92` interpolate raw user input into PostgREST `.or()`
filter strings:

```ts
conditions.push(`location.ilike.%${term}%`)
```

A query containing `,` `)` or `.` can alter the filter tree. Escape or
parameterise both. This is reachable by any signed-in student from the search
box.

### B5. Fix the cron timeouts · ~1 day

A full ATS pass takes **650s** and Unstop **~1,200s**, against Vercel Hobby's
**300s** ceiling. Every nightly run truncates roughly half way. Not dangerous —
reconciliation only runs after the provider loop completes, so a truncated run
can never delete anything — but **half your sources go stale each night**, which
undermines the core promise.

Two routes:

| Option | Cost | Effect |
|---|---|---|
| **Vercel Pro** | $20/mo | 800s ceiling. Fixes ATS (650s), not Unstop (1,200s) |
| **Queue migration** | ~1 day | Removes the ceiling entirely; scales to 500+ boards |

`QueueProducerService`, `QueueConsumerService`, the `ingestion_queue` table and
`claim_queue_batch` already exist and are unused. **Do the queue migration.**
Pro alone is a half-fix.

### B6. Error monitoring · 2 hours

No Sentry, no alerting. Today a broken nightly cron is invisible until someone
notices the catalogue is stale — which is exactly how the pipeline sat dead from
17 June to 9 August. Wire Sentry, and alert on:
- any cron returning non-2xx
- `ingestion_logs` with `records_updated = 0`
- AI gateway `all_failed`

---

## 2. Should fix before real traffic

| # | Item | Why | Est. |
|---|---|---|---|
| S1 | Verify apply links at scale | 10/10 spot-checked, 4,103 unverified. "Every link works" is the core promise and is not yet provable | 4h |
| S2 | Turn off `ignoreBuildErrors` | `next.config.ts:18` hides 36 real type errors, so the build cannot catch what it should | 1d |
| S3 | Fix 5 failing ATS tests | The AI-failure path returns a score when it should return `aiFailed` — the system can show a confident score that is not real | 3h |
| S4 | Email provider | Settings promises "weekly opportunity matches"; nothing can send. Either build it or remove the toggle | 3h |
| S5 | Internshala scraper | 32 live from 832 stored — mostly broken | 4h |
| S6 | Tighten CSP | `unsafe-eval` + `unsafe-inline` on scripts | 3h |
| S7 | Legal review: AGPL | The resume builder is vendored Reactive Resume (AGPL-3.0). The network clause applies to hosted services. Get advice before promoting the feature | — |

---

## 3. Capacity — the honest ceiling

Two very different limits.

**Search** scales fine. It is cron-driven ingestion plus Postgres reads; 4,103
opportunities serve any number of students.

**AI Search does not.** From the agent's own measurements:
- **5–20 minutes per run, one job at a time**
- Free provider tiers: **roughly one student per day**
- Paid: **$0.006–$0.041 per student**

At one concurrent job, the theoretical ceiling is ~72 runs/day at 20 minutes
each — and that assumes no throttling. **AI Search cannot be offered to every
student on day one.**

Options, in order of how honest they are:
1. **Waitlist / invite only.** One run per student per week, queued. Sets the
   expectation correctly.
2. **Paid provider tiers** plus a per-student daily cap.
3. **Horizontal agent workers** — the pipeline is single-concurrency by design;
   this is real engineering, not a config change.

The UI already enforces one run at a time per student, and states the 5–20
minute expectation up front. Do not remove either.

---

## 4. Running cost

| Item | Monthly |
|---|---|
| Vercel Pro (recommended regardless of B5) | $20 |
| Agent VPS (4 GB, docker compose) | $20–25 |
| Supabase — free tier is fine initially; Pro when you outgrow it | $0–25 |
| AI providers — ATS, resume parsing, assistant | $10–40 |
| AI Search at 30 students/month | $0.20–1.25 |
| **Total** | **~$50–110/month** |

AI Search is not the expensive part. Hosting is.

---

## 5. Sequence

**Week 1 — make it safe**
B1 migrations · B3 auth bypasses · B4 injection · B6 monitoring
→ *Outcome: nothing open that a student could trip over or abuse.*

**Week 2 — make it complete**
B5 queue migration · B2 host the agent · S1 link verification
→ *Outcome: nightly refresh finishes, AI Search works in production, link
promise is provable.*

**Week 3 — make it trustworthy**
S2 type errors · S3 ATS tests · S4 email or remove the toggle · S5 Internshala
→ *Outcome: no known-wrong behaviour shipping.*

**Then launch** — invite-only, with AI Search waitlisted.

---

## 6. Launch-day checklist

- [ ] Both migrations applied; `/certifications` and `/ai-search` load with data
- [ ] `AI_AGENT_URL` set in Vercel; agent reachable and behind a shared secret
- [ ] A full AI Search run completed end to end against the hosted agent
- [ ] Every cron returns 2xx and `ingestion_logs` shows `records_updated > 0`
- [ ] `updated in last 48h` is non-zero — the automation proving itself unattended
- [ ] Sentry receiving events; cron-failure alert tested by forcing one
- [ ] Auth verified logged-out on every protected route
- [ ] `ENABLE_OPP_INGESTION`, `CRON_SECRET` present in Production only
- [ ] Rotate `CRON_SECRET` (it appeared in a screenshot during development)
- [ ] Supabase Auth redirect URLs match the production domain
- [ ] Remove the "weekly opportunity matches" toggle unless S4 is done

---

## 7. Deliberately deferred

Not blockers. Do not let them delay launch.

- **Hub** — 0%; `/hub` currently redirects to `/search`. Either build it or drop
  the nav item, but it is a 2–3 week feature.
- **Resume Optimization** — `/resume/copilot` is a static mockup with a
  hardcoded score of 68 and two dead buttons. **Remove it from the nav until it
  is real**; shipping it as-is is the one thing here that would actively
  mislead a student.
- **AI Voice Interview** — 0%, 3–4 weeks.
- 163 hardcoded hex colours; dark mode defined but never mounted.
- `lib/` vs `libs/` duplication; two resume systems.
- ~110 junk files and 13 stale docs (see the original audit).
