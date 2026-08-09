# AI Search & AI Voice Interview — State, Architecture and Handoff Brief

**Date:** 10 August 2026
**Audience:** the engineer or coding agent who will make these two features work.
**Companion document:** `docs/AUDIT-2026-08-10.md` (full system audit).

---

## 0. Why these two could not be audited like the rest

Every other feature in Opportunity Radar lives in one Next.js codebase with one database, so it can be read, built and queried. These two do not:

- **AI Search** is a separate multi-service system in its own repository, currently only runnable on a laptop. Opportunity Radar points at `http://localhost:4300`.
- **AI Voice Interview** does not exist in Opportunity Radar at all. It is a fork of a third-party product in another repository, being worked on by a different agent.

So what follows is not a pass/fail audit. It is a **state report plus the work that remains**, written so it can be handed over directly.

---

## 1. Where everything is on this machine

| What | Absolute path | Repo | Notes |
|---|---|---|---|
| **Opportunity Radar** (main app) | `/Users/laxmansirvi/Opportunity radar` | branch `restore-june19` | The Next.js app + Supabase |
| **AI Search agent** | `/Users/laxmansirvi/ai  agent ` | own git repo | ⚠️ folder name has **two spaces** after `ai` and a **trailing space** — quote it in every shell command |
| **AI Voice Interview** | `/Users/laxmansirvi/DeepInterview` | own git repo, Apache-2.0 | pnpm + turbo monorepo |
| Resume-builder fork | `/Users/laxmansirvi/reactive-resume` | `github.com/Laxmansirvi05/ResumeAI` | See licensing note in the audit, §5 |
| Landing page | `/Users/laxmansirvi/opp-radar-landing-page` | | Out of audit scope |
| Older recovery copy | `/Users/laxmansirvi/Opportunity-Radar-Recovery` | | Appears to be a backup |

**Housekeeping before anything else:** three debug files in the AI Search repo total **363 MB** —
`final_n8n_run.txt` (188 MB), `n8n_output.json` (93 MB), `pipeline_execution.json` (82 MB).
Delete them and add them to `.gitignore` before that repo is ever pushed.

---

## 2. AI Search

### 2.1 What exists and is good

The agent is genuinely well-architected and documented. It ships `ARCHITECTURE.md`, `API_CONTRACT.md`, `INTEGRATION_GUIDE.md`, `RUNBOOK.md` and `SECURITY.md`.

Its stated invariants are exactly right for this product, and they should not be renegotiated:

1. A failed score is never a low score — `scored`, `failed`, `skipped_no_content` stay distinct.
2. Never pad results. Fewer real matches beat more fake ones.
3. Every returned item has a real `apply_url` to a **specific posting** — never a listing, category or careers root.
4. Nothing is invented. Unstated fields stay `null`.

> Invariant 3 is worth underlining: Opportunity Radar's own search currently violates the equivalent rule **376 times** (see audit §2.2). Do not let the agent inherit that failure.

### 2.2 Runtime topology

```
Opportunity Radar backend  (Vercel)
        │  POST /api/jobs  (PDF)
        │  GET  /api/jobs/:id
        ▼
   job-server        :4300   ── pipeline_jobs (Postgres)
        │  spawns one job at a time
        ▼
   n8n workflow  (workflows.json, 14 stages)
        ├─ ai-gateway      :4000   all LLM calls + provider failover
        ├─ search-planner  :4200   resume → search intelligence
        └─ render-service  :3100   headless browser for JS-heavy pages
                                    (Playwright — needs real memory)
   plus: Postgres, Redis, Tavily API (~45 queries per run)
```

**This is six services, n8n, Postgres and Redis.** It cannot run on Vercel — not as serverless functions, not with a 300-second ceiling, not with Playwright. It needs a always-on VM.

### 2.3 The Opportunity Radar side — already built, currently dead

| Piece | Path | State |
|---|---|---|
| Agent client | `frontend/lib/ai-search/agent-client.ts` | ✅ complete |
| Submit route | `frontend/app/api/ai-search/route.ts` | ✅ complete |
| Poll route | `frontend/app/api/ai-search/[jobId]/route.ts` | ✅ complete |
| UI | `frontend/features/ai-search/components/ai-search-client.tsx` | ✅ complete, 457 lines |
| Page | `frontend/app/(protected)/ai-search/page.tsx` | ✅ complete |
| **Database table** | `ai_search_jobs` | ❌ **does not exist in production** |

The design decisions here are correct and should be preserved:

- The browser never talks to the agent. The agent has CORS off and its job ids carry no authorization, so it must stay behind the backend.
- One run per student at a time — the agent is single-threaded.
- PDF magic bytes are checked before upload, so a `.docx` renamed to `.pdf` fails fast with a clear message.
- Polling every 15s with a 30-minute ceiling; a page reload resumes an in-flight run.
- The progress stages are labelled honestly as indicative, because the agent exposes no progress and a fake percentage would be a lie.

### 2.4 Three blockers, in order

**Blocker 1 — the table is missing.**
`20260809180000_ai_search_jobs.sql` exists locally but is not applied. Apply it individually. Do **not** run a blanket `supabase db push`: several older migrations contain bulk `INSERT` statements and would duplicate catalogue data.

**Blocker 2 — `AI_AGENT_URL=http://localhost:4300`.**
Verified unreachable. This must become the deployed agent's private address.

**Blocker 3 — the agent is not deployed anywhere.**

### 2.5 Recommended deployment

Keep the split you already chose:

```
Vercel (free)                    Oracle Cloud Always Free VM (Ampere A1, ARM)
┌────────────────────────┐       ┌──────────────────────────────────────────┐
│ Next.js app            │       │ job-server :4300                         │
│ Supabase (managed)     │──────▶│ ai-gateway :4000                         │
│ AI_AGENT_URL ──────────┼──────▶│ search-planner :4200                     │
└────────────────────────┘       │ render-service :3100  (Playwright)       │
                                 │ n8n + Postgres + Redis                   │
                                 └──────────────────────────────────────────┘
```

Oracle's Always Free tier has historically offered 4 Ampere A1 cores and 24 GB RAM, which is enough for this stack. **Verify the current terms yourself before committing** — free-tier allowances change, and ARM capacity in a given region is frequently unavailable.

Security requirements for that VM:

- Do **not** expose ports 4300/4000/4200/3100 to the internet. Bind to a private interface or put Caddy/nginx in front with a shared secret header that the Vercel backend sends.
- Terminate TLS at the proxy. `AI_AGENT_URL` should be `https://`.
- Keep CORS off, as the agent's own `SECURITY.md` says.
- Give the agent its **own** LLM API keys. Right now Opportunity Radar shares one key across AI Search, ATS and the assistant — one leak burns all three.

### 2.6 Acceptance criteria

- [ ] `ai_search_jobs` exists in production with RLS restricting rows to `user_id = auth.uid()`.
- [ ] A student uploads a PDF and receives 5–10 opportunities within 30 minutes.
- [ ] Every returned `apply_url` resolves to a specific posting — verified by HTTP check, not by inspection.
- [ ] A failed scoring run reports `failed`, never a low score.
- [ ] Two concurrent submissions from the same student produce one run, not two.
- [ ] Killing the agent mid-run leaves the UI showing an honest error, not an infinite spinner.
- [ ] Agent ports are unreachable from the public internet — verified with an external port scan.

---

## 3. AI Voice Interview

### 3.1 Current state

Nothing exists in Opportunity Radar except one line of correct groundwork in `next.config.ts`:

```
Permissions-Policy: camera=(), microphone=(self), geolocation=(), browsing-topics=()
```

`microphone=(self)` is required — `getUserMedia` is refused outright without it, and no client-side code can work around that. Keep it.

The implementation lives in `/Users/laxmansirvi/DeepInterview`, a fork of a third-party product (**Apache-2.0** — permissive, no copyleft obligation, unlike the resume-builder situation). Another agent is working there, guided by `NEXT_STEPS.md`, `OPPORTUNITY_RADAR_INTEGRATION.md`, `OPPORTUNITY_RADAR_REFACTOR.md` and `OPPORTUNITY_RADAR_CORRECTIONS.md`.

### 3.2 What that stack needs to run

From its `docker-compose.yml`:

| Service | Purpose | Cost to run |
|---|---|---|
| `agent-api` | HTTP API | light |
| `agent-worker` | interview orchestration | light |
| `web` | its own Next.js UI | light |
| `lightrag` | retrieval over interview skills | moderate |
| **`ollama`** | local LLM | **heavy — several GB RAM, slow on ARM CPU** |
| **`whisper`** | speech-to-text | **heavy** |
| **`kokoro`** | text-to-speech | **moderate** |
| Postgres | state | light |

**This is the hard constraint to plan around.** A 10–15 minute voice conversation needs sub-second turnaround on speech-to-text → LLM → text-to-speech. Running Ollama, Whisper and Kokoro together on a CPU-only ARM VM will not deliver that; the conversation will feel broken.

There are two honest options:

- **Option A — hosted inference (recommended for a demo).** Keep the orchestration self-hosted; call hosted APIs for STT, the LLM and TTS. Groq's Whisper endpoint and a hosted TTS give real-time latency at low or zero cost within free tiers. The repo's provider abstraction already treats provider values as a contract rather than a vendor, so this is a configuration change, not a rewrite.
- **Option B — all-local.** Only viable with a GPU. Not available on Oracle's free tier.

**Do not attempt to run AI Search and the voice stack on the same free VM.** Together they exceed what 24 GB and 4 shared ARM cores can serve while staying responsive.

### 3.3 What Opportunity Radar must build (none of this exists yet)

Everything below is new work **in this repository**:

**Database**
```sql
interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  resume_id uuid references resumes(id) on delete set null,
  role_title text,
  status text not null check (status in ('pending','in_progress','completed','failed','abandoned')),
  external_session_id text,          -- the id on the DeepInterview side
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now()
);

interview_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  overall_score numeric(5,2),
  dimension_scores jsonb,            -- communication, depth, structure, role fit
  strengths jsonb,
  improvements jsonb,
  transcript_url text,               -- Supabase Storage, private bucket
  created_at timestamptz not null default now()
);
```
Both need RLS restricting rows to `user_id = auth.uid()`, and GRANTs to **both** `authenticated` **and** `service_role`. *(The missing `service_role` grant on `notifications` is exactly the bug that breaks the nightly cron today — do not repeat it.)*

**Backend** — `/api/interview/start`, `/api/interview/[sessionId]`, and a webhook or poll to collect the report. Same pattern as AI Search: the browser never talks to the interview service directly.

**Frontend** — a pre-flight microphone permission and level check, the live conversation view, and a report view.

**Storage** — a private `interview-recordings` bucket with owner-scoped policies, plus a stated retention period. Voice recordings are far more sensitive than a resume.

### 3.4 Contract to agree with the other agent

Ask them to commit to this shape, in writing, before either side builds against it:

```jsonc
// POST /api/sessions
{ "resume_text": "…", "role_title": "Backend Engineer",
  "job_description": "…", "duration_minutes": 12 }
// → 202
{ "session_id": "…", "join_token": "…", "expires_at": "…" }

// GET /api/sessions/:id
{ "session_id": "…",
  "status": "pending|in_progress|completed|failed",
  "report": {
    "overall_score": 72.5,
    "dimensions": { "communication": 80, "technical_depth": 65,
                    "structure": 74, "role_fit": 71 },
    "strengths": ["…"],
    "improvements": ["…"],
    "transcript": "…"
  }
}
```

Four questions to settle now, because each one changes the frontend:

1. **Does audio flow through their service or peer-to-peer (WebRTC/LiveKit)?** This determines whether Opportunity Radar needs a token exchange and whether their host must be in the CSP `connect-src`.
2. **Is the join token single-use and short-lived?** It must be.
3. **Do they push a webhook on completion, or do we poll?** Webhook needs a shared secret and signature verification.
4. **Who stores the recording, and for how long?**

### 3.5 CSP will need changing

The current policy is `connect-src 'self' … https://*.supabase.co … wss://*.supabase.co`. A voice session over WebRTC or a websocket to another host **will be blocked**. Add that specific host — do not widen the policy to `*`.

### 3.6 Acceptance criteria

- [ ] A student completes a 10–15 minute conversation with no audio dropout.
- [ ] A scored report is persisted and still visible after logout and login.
- [ ] Denying microphone permission produces a clear explanation, not a blank screen.
- [ ] Losing the network mid-interview marks the session `abandoned`, not `in_progress` forever.
- [ ] Recordings are in a private bucket, and one student cannot read another's.
- [ ] The interview host is explicitly allowed in the CSP.

---

## 4. Sequencing

Do these in order. The first item is a prerequisite for everything else and takes an hour.

1. **Fix the deployed database** — the 7 missing tables and the `notifications` GRANT (audit §9). Nothing else is worth doing until the schema matches the code.
2. **Deploy the AI Search agent to one Oracle VM.** It is closer to working than the voice feature, and the deployment pattern you establish here is the one the voice service will reuse.
3. **Point `AI_AGENT_URL` at it and prove one end-to-end run**, with every returned `apply_url` HTTP-verified.
4. **Agree the voice contract in §3.4 in writing** with the other agent. Only then build the Opportunity Radar side.
5. **Deploy the voice stack on a second VM**, with hosted STT/LLM/TTS (Option A).

---

## 5. One thing worth saying plainly

Both of these are the ambitious parts of the product, and both are blocked on **operations, not code**. The AI Search agent is well-built; the voice fork is a mature Apache-2.0 project. What is missing in each case is a deployed home and a database that matches the application.

That is a much better problem to have than the reverse. But it will not fix itself, and it is the reason the project reads as ~58% complete rather than ~80%.
