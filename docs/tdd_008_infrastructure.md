# TDD-008: Production Infrastructure
**Project:** Opportunity Radar V2
**Stack:** Next.js 16 on Vercel, Supabase (PostgreSQL + Storage + Auth)
**Version:** 1.0

---

## SECTION 1: ARCHITECTURE OVERVIEW

```
┌────────────────────────────────────────────────────────────────┐
│                     INTERNET / DNS                             │
│                   opportunityradar.in                          │
└───────────────────────────┬────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   Vercel CDN  │  ← Static assets, Edge caching
                    │   (Global)    │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  Next.js App  │  ← Vercel Serverless Functions
                    │  (Serverless) │    Route Handlers + Server Actions
                    └───────┬───────┘
                            │
          ┌─────────────────┼────────────────┐
          │                 │                │
  ┌───────▼──────┐  ┌───────▼──────┐  ┌─────▼────────┐
  │   Supabase   │  │ Gemini API   │  │   Groq API   │
  │  PostgreSQL  │  │  (Google)    │  │  (Fallback)  │
  │  + Storage   │  └──────────────┘  └──────────────┘
  │  + Auth      │
  └──────────────┘
```

### Why This Stack?

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| Hosting | Vercel | Zero-config Next.js deployment. Free hobby tier covers MVP. Automatic preview deployments per PR. |
| Database | Supabase | PostgreSQL with built-in Auth, Storage, and RLS. No separate auth server needed. Free tier = 500MB DB, 1GB storage. |
| CDN | Vercel Edge | Automatic. Static pages and assets cached globally. |
| AI | Gemini + Groq | Per TDD-007. |
| Monitoring | Sentry (free tier) | Error tracking with Next.js integration. |
| Logging | Supabase Logs + Vercel Logs | Sufficient for MVP. |

---

## SECTION 2: DEPLOYMENT ARCHITECTURE

### Environments

| Environment | Branch | URL | Purpose |
| :--- | :--- | :--- | :--- |
| Production | `main` | opportunityradar.in | Live users |
| Staging | `staging` | staging.opportunityradar.in | Pre-release testing |
| Preview | Any PR | `<hash>.vercel.app` | Per-PR review |
| Local | `*` | `localhost:3000` | Development |

### Vercel Configuration (`vercel.json`)

```json
{
  "regions": ["bom1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com"
        }
      ]
    }
  ]
}
```

**Why `maxDuration: 30`?** Gemini API calls can take up to 10s. Skill extraction backfill batches may take longer. 30s is the Vercel Pro limit; free tier is capped at 10s. This is a known constraint — the backfill script must run locally or via a separate process, not a Vercel function.

---

## SECTION 3: CI/CD PIPELINE

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test

  deploy-staging:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Deployment Gate Rules

- `main` branch is protected. No direct pushes. PR required.
- CI must pass (lint + type-check + unit tests) before merge.
- Staging deployment is automatic on merge to `staging`.
- Production deployment is automatic on merge to `main`.

---

## SECTION 4: SECRETS MANAGEMENT

### Secret Categories

| Secret | Where Stored | Access Scope |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env (all envs) | Public (client-side safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env (all envs) | Public (client-side safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (production only) | Server-side only. NEVER expose to client. |
| `GEMINI_API_KEY` | Vercel env (production + staging) | Server-side only |
| `GROQ_API_KEY` | Vercel env (production + staging) | Server-side only |
| `SENTRY_DSN` | Vercel env (production) | Client-side safe |

### Rules

1. `SUPABASE_SERVICE_ROLE_KEY` is used ONLY in the backfill script and admin operations. Never in Route Handlers serving users.
2. All secrets are rotated on team member offboarding.
3. `.env.local` is gitignored. Team members configure their own local secrets.
4. Secret rotation procedure: Update Vercel env → trigger a redeploy.

---

## SECTION 5: MONITORING & LOGGING

### Error Tracking: Sentry

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of requests for performance tracing
  environment: process.env.NODE_ENV,
})
```

**What Sentry tracks:**
- Unhandled JavaScript errors (client + server)
- API route errors (500s)
- Slow transactions (> 2s)

**What Sentry does NOT track:**
- User resume content (PII — never sent to Sentry)
- AI prompt or response text

### Application Logging

All critical application events are logged to dedicated Supabase tables (already designed in each TDD):

| Log Table | Purpose |
| :--- | :--- |
| `ai_usage_log` | AI provider usage, cost, latency |
| `extraction_log` | Skill extraction results per opportunity |
| `optimizer_requests` | Resume optimizer calls per user |
| `application_events` | Application tracker stage changes |

### Uptime Monitoring

Use **UptimeRobot** (free tier):
- Check `https://opportunityradar.in/api/health` every 5 minutes.
- Alert via email if down for > 2 minutes.

### Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const dbCheck = await supabase.from('profiles').select('id').limit(1)
  return Response.json({
    status: dbCheck.error ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'
  })
}
```

---

## SECTION 6: STORAGE ARCHITECTURE

### Supabase Storage Buckets

| Bucket | Purpose | Access | Size Limit |
| :--- | :--- | :--- | :--- |
| `resumes` | Student PDF uploads | Private (signed URLs) | 5MB per file |
| `company-logos` | Opportunity company logos | Public | 500KB per file |

### Signed URL Strategy

Resume files are never served via public URLs. To display a resume or pass it to the parsing pipeline, generate a short-lived signed URL:

```typescript
const { data } = await supabase.storage
  .from('resumes')
  .createSignedUrl(filePath, 300)  // 5 minute expiry
```

### Storage Cleanup

- On `resumes` table `DELETE` or status → `failed`: Delete associated storage file via `supabase.storage.from('resumes').remove([filePath])`.
- Orphaned files (no matching DB row): Run a monthly cleanup script.

---

## SECTION 7: RATE LIMITING

### API-Level Rate Limiting (MVP: Application Layer)

```typescript
// middleware.ts (Next.js middleware — runs at Edge)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory store (works for single Vercel instance; upgrade to Upstash Redis for multi-region)
const requestCounts = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/resume/parse':    { max: 3,   windowMs: 3_600_000 },  // 3/hour
  '/api/resume/optimize': { max: 20,  windowMs: 86_400_000 }, // 20/day
  '/api/ats/analyze':     { max: 60,  windowMs: 3_600_000 },  // 60/hour
  '/api/tracker':         { max: 100, windowMs: 3_600_000 },  // 100/hour
}

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const path = req.nextUrl.pathname
  const limit = Object.entries(RATE_LIMITS).find(([route]) => path.startsWith(route))

  if (!limit) return NextResponse.next()

  const [, { max, windowMs }] = limit
  const key = `${ip}:${path}`
  const now = Date.now()
  const record = requestCounts.get(key)

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs })
    return NextResponse.next()
  }

  if (record.count >= max) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  record.count++
  return NextResponse.next()
}
```

> **Note:** In-memory rate limiting works per Vercel instance. For multi-region or high-scale, upgrade to **Upstash Redis** (`@upstash/ratelimit` library) — a 5-line change.

---

## SECTION 8: DATABASE BACKUPS

### Supabase Automatic Backups

- Supabase Pro plan includes daily Point-in-Time Recovery (PITR).
- Free plan: Daily backups retained for 7 days.
- **For MVP (free plan):** Export a manual backup weekly via Supabase Dashboard → Database → Backups.

### Custom Backup Script (MVP)

```bash
#!/bin/bash
# scripts/backup-db.sh — run weekly via cron or GitHub Actions scheduled workflow
pg_dump "$SUPABASE_DB_URL" \
  --no-acl --no-owner \
  -f "backups/backup-$(date +%Y%m%d).sql"

# Upload to Supabase Storage (separate admin bucket)
# Or: upload to any S3-compatible storage
```

### Recovery Procedure

1. Identify last known good backup timestamp.
2. Restore via `psql $SUPABASE_DB_URL < backup-YYYYMMDD.sql`.
3. Test critical queries (user login, opportunity search, resume retrieval).
4. Re-run any migrations applied since the backup.

---

## SECTION 9: SECURITY HARDENING

### HTTPS

All traffic is HTTPS-only. Vercel enforces this automatically. HTTP → HTTPS redirect is built in.

### Security Headers

Applied via `vercel.json` (see Section 2). Key headers:
- `X-Frame-Options: DENY` — prevents clickjacking.
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing.
- `Content-Security-Policy` — restricts asset sources.

### Supabase RLS

Every user-owned table has RLS enabled. Critical policy pattern:
```sql
-- Default deny: No access unless explicitly permitted
CREATE POLICY "deny_all" ON <table> FOR ALL USING (false);
-- Then add specific allow policies
CREATE POLICY "own_rows" ON <table> FOR ALL USING (auth.uid() = user_id);
```

### Dependency Security

- `npm audit` runs in CI on every PR.
- Dependabot alerts configured on GitHub repository.
- Lock file (`package-lock.json`) committed to source control.

### File Upload Security

- MIME type validation server-side (magic bytes check, not just extension).
- 5MB file size limit enforced at both Next.js middleware level and Supabase Storage bucket config.
- No executable file types permitted.

---

## SECTION 10: SCALING STRATEGY

### Current Scale (0–1,000 Users, MVP)

- Vercel Hobby/Pro: Handles easily.
- Supabase Free: 500MB DB is sufficient for < 10,000 resume rows + 5,000 opportunities.
- No caching infrastructure needed.
- Total infra cost: **~$0–$25/month**.

### Near-term Scale (1,000–10,000 Users)

| Upgrade | When | Action |
| :--- | :--- | :--- |
| Supabase Pro | > 500MB DB | Upgrade plan ($25/month). Enables PITR backups. |
| Activate `ats_cache` table | P95 > 500ms | Enable cache writes in ATS Engine handler. |
| Activate `user_opportunity_matches` | P95 feed > 2s | Enable background match score computation. |
| Upstash Redis rate limiting | Multi-region needed | Replace in-memory rate limiter (~$3/month). |

### Long-term Scale (10,000+ Users)

- Separate ingestion/background jobs to Render or Railway workers (escape Vercel 30s timeout).
- Read replicas for Supabase (available on Pro).
- CDN for static opportunity assets.

---

## SECTION 11: COST ESTIMATES

### Monthly Operating Cost (MVP, < 1,000 users)

| Service | Plan | Monthly Cost |
| :--- | :--- | :--- |
| Vercel | Hobby (free) → Pro if needed | $0–$20 |
| Supabase | Free tier | $0 |
| Gemini API | Pay-as-you-go | < $5 |
| Groq API | Free tier | $0 |
| Sentry | Free tier (5,000 errors/month) | $0 |
| UptimeRobot | Free tier | $0 |
| Domain | Annual | ~$1/month |
| **Total** | | **< $26/month** |

---

## SECTION 12: PRODUCTION READINESS CHECKLIST

**Before Launch:**

**Infrastructure:**
- [ ] Custom domain configured and DNS propagated
- [ ] SSL certificate active (Vercel auto-manages)
- [ ] All environment variables set in Vercel production environment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed server-side only
- [ ] Security headers verified via [securityheaders.com](https://securityheaders.com)

**Database:**
- [ ] All migrations applied to production Supabase instance
- [ ] RLS enabled on ALL user-owned tables
- [ ] `extracted_skills` backfill completed and verified (> 95% coverage)
- [ ] All indexes created and verified with `EXPLAIN ANALYZE`
- [ ] Manual database backup taken before launch

**Application:**
- [ ] All API routes return correct HTTP status codes (not 200 for errors)
- [ ] All API routes validate auth before processing
- [ ] Rate limiting active on all AI and upload endpoints
- [ ] `GET /api/health` returns `{ status: 'ok' }` in production

**Monitoring:**
- [ ] Sentry DSN configured and receiving test errors
- [ ] UptimeRobot monitoring `opportunityradar.in/api/health` every 5 minutes
- [ ] AI cost alerts configured in Google Cloud console (Gemini)
- [ ] Daily monitoring SQL queries bookmarked / scheduled

**CI/CD:**
- [ ] `main` branch protection rules enabled (require PR + CI pass)
- [ ] GitHub Actions CI workflow passing on `main`
- [ ] Vercel production deployment auto-triggers on `main` merge

**User-Facing:**
- [ ] Privacy Policy published at `/privacy`
- [ ] Terms of Service published at `/terms`
- [ ] File upload error messages are user-friendly (not stack traces)
- [ ] 404 and 500 error pages styled and deployed

---

## SECTION 13: CTO REVIEW

**Approved:**
- Vercel + Supabase for MVP: correct. Zero-ops infrastructure for a small team. Costs < $26/month.
- In-memory rate limiting for MVP: correct. Single Vercel instance at this scale; Redis is premature.
- Sentry free tier: correct. Error tracking is non-negotiable; Sentry free is sufficient.
- GitHub Actions for CI/CD: correct. No additional tooling needed.
- Security headers via `vercel.json`: correct. One-time setup, permanent protection.

**Rejected:**
- Kubernetes / Docker containers: dramatically over-engineered for a student-team product with < 1,000 users.
- AWS/GCP deployment: adds infrastructure management burden with no benefit at this scale.
- Separate auth service: Supabase Auth covers all requirements. No separate service justified.
- Redis at MVP: premature. DB-backed rate limiting is sufficient.

**Risks:**
- Vercel 10s function timeout on free tier: Resume parsing pipeline could breach this. Mitigation: Upgrade to Vercel Pro ($20/month) before launch, which allows 30s.
- Supabase free tier 500MB limit: Will be reached at ~5,000 users with full resume data. Monitor monthly and upgrade before hitting limit.
- Single-region deployment (Mumbai/bom1): Acceptable for Indian student market. Latency for international users will be higher.

**Verdict: ✅ Cleared for implementation. This infrastructure is right-sized for a student-team MVP with a clear scaling path documented.**
