# Opportunity Radar V2

**A Student Career Operating System** — personalised opportunity discovery, ATS analysis, and resume optimisation in one platform.

---

## What It Does

| Feature | How It Works |
|---|---|
| **Resume Parser** | PDF → Gemini Flash (AI Gateway) → structured JSON |
| **Recommendation Engine** | Deterministic PostgreSQL scoring (6 components) |
| **ATS Engine** | Pure TypeScript scoring — no AI, fully explainable |
| **Resume Optimizer** | STAR-method bullet rewrites via AI Gateway |
| **Application Tracker** | 5-stage Kanban with score snapshots |
| **Skill Extraction** | Background pipeline with governance tracking |

---

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **Backend:** Next.js Route Handlers + Server Actions
- **Database:** Supabase PostgreSQL (Supabase Pro)
- **AI:** Gemini 1.5 Flash (primary) → Groq Llama-3 (fallback) via AI Gateway
- **Deployment:** Vercel Pro

---

## Architecture Rules

1. **All AI calls go through the AI Gateway** — no direct Gemini/Groq SDK calls in features.
2. **ATS scoring is deterministic** — no AI in the scoring pipeline.
3. **Resume optimisation is non-destructive** — originals are always preserved in `resume_versions`.

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (Pro tier recommended)
- Gemini API key (Google AI Studio)
- Groq API key (groq.com — free tier)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/opportunity-radar.git
cd opportunity-radar/frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Fill in all values in .env.local

# 4. Run database migrations
npx supabase db push

# 5. Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Database Migrations

Run V2 migrations in order after the existing schema:

```bash
# From repository root
npx supabase db push
```

Migration order:
| File | Purpose |
|---|---|
| `20260619000001_resume_system.sql` | Resumes table, RLS, v_student_ats_inputs view |
| `20260619000002_recommendation_engine.sql` | Skill governance, frequency index, ranking RPC |
| `20260619000003_ats_engine.sql` | ATS cache (pre-built for scale), skill importance view |
| `20260619000004_application_tracker.sql` | 5-stage applications, events, board RPC |
| `20260619000005_skill_extraction.sql` | Extraction log, optimizer audit trail |
| `20260619000006_ai_gateway_logs.sql` | AI usage log, rate limit RPC, cost view |

---

## Running Tests

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests cover:
- ATS Engine scoring (all components + edge cases)
- Recommendation Engine (match labels, sort, filter)
- Resume Parser (Zod validation, PDF validation, fabrication guard)
- AI Gateway (type guards, cost estimation)
- Application Tracker (board builder, Kanban positions)

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── resume/upload/       # PDF upload → Storage
│   │       ├── resume/parse/        # AI parsing pipeline
│   │       ├── resume/save/         # Verify + extract skills
│   │       ├── resume/optimize/     # STAR bullet rewrites
│   │       ├── opportunities/recommended/  # Ranked feed
│   │       ├── ats/analyze/         # ATS score + gap analysis
│   │       └── tracker/             # Kanban board CRUD
│   ├── lib/
│   │   ├── ai-gateway/             # Centralised AI access (Gemini → Groq)
│   │   ├── resume-parser/          # PDF extraction + AI parsing
│   │   ├── ats-engine/             # Deterministic ATS computation
│   │   ├── recommendation-engine/  # Feed helpers (scoring in DB RPC)
│   │   ├── resume-optimizer/       # STAR method rewrites
│   │   └── tracker/                # Kanban utilities
│   └── types/                      # Canonical TypeScript interfaces
├── tests/                          # Unit tests (Vitest)
└── supabase/migrations/            # SQL migrations
```

---

## Environment Variables

See [.env.example](.env.example) for all required variables.

**Required before launch:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `NEXT_PUBLIC_APP_URL`

---

## Deployment

### Vercel

1. Connect your GitHub repository in the Vercel dashboard.
2. Set the **Root Directory** to `frontend`.
3. Add all environment variables from `.env.example`.
4. Deploy — Vercel Pro is required for the 30s function timeout on the parse pipeline.

### Required Vercel Secrets (GitHub Actions)

```
VERCEL_TOKEN       → Your Vercel API token
VERCEL_ORG_ID      → Your Vercel team/org ID
VERCEL_PROJECT_ID  → Your Vercel project ID
```

---

## AI Cost Estimate

At 500 Daily Active Users:

| Provider | Usage | Cost/month |
|---|---|---|
| Gemini Flash | Resume parsing + optimization | ~$0.39 |
| Groq | Fallback only (< 5% of calls) | $0.00 |
| **Total** | | **< $1/month** |

Cost alert is set at $20/month in the approved architecture.

---

## Scaling Milestones

| DAU | Action Required |
|---|---|
| 500 | Current architecture — no changes |
| 1,000 | Activate `ats_cache` table |
| 2,000 | Activate Supavisor (Supabase connection pooler) + Pro plan |
| 5,000 | Activate `user_opportunity_matches` nightly cache |

---

## Documentation

All TDDs and architecture documents are in [`docs/`](docs/).

| Document | Purpose |
|---|---|
| [master_architecture_alignment.md](docs/master_architecture_alignment.md) | **Single source of truth** |
| [resume_parser_tdd.md](docs/resume_parser_tdd.md) | TDD-001 |
| [recommendation_engine_tdd.md](docs/recommendation_engine_tdd.md) | TDD-002 |
| [ats_engine_tdd.md](docs/ats_engine_tdd.md) | TDD-003 |
| [tdd_004_resume_optimizer.md](docs/tdd_004_resume_optimizer.md) | TDD-004 |
| [tdd_005_application_tracker.md](docs/tdd_005_application_tracker.md) | TDD-005 |
| [tdd_006_skill_extraction.md](docs/tdd_006_skill_extraction.md) | TDD-006 |
| [tdd_007_ai_gateway.md](docs/tdd_007_ai_gateway.md) | TDD-007 |
| [tdd_008_infrastructure.md](docs/tdd_008_infrastructure.md) | TDD-008 |
